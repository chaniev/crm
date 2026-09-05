using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Bot;
using GymCrm.Application.Clients;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Bot;

internal sealed class BotApiService(
    GymCrmDbContext dbContext,
    IAttendanceService attendanceService,
    IAuditLogService auditLogService,
    BotIdempotencyService idempotencyService,
    IBusinessDateProvider businessDateProvider,
    IAttendanceDatePolicy attendanceDatePolicy,
    IAccessScopeService accessScopeService,
    IClientMembershipEntitlementResolver entitlementResolver) : IBotApiService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private const string DateFormat = "yyyy-MM-dd";
    private const int DefaultSearchTake = 20;
    private const int MaxSearchTake = 50;
    private const int ClientCardAttendanceTake = 20;

    public async Task<BotApiResult<BotUserContext>> ResolveUserContextAsync(
        BotIdentity identity,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotUserContext>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        return BotApiResult<BotUserContext>.Success(MapUserContext(user, identity));
    }

    public async Task<BotApiResult<BotMenuResponse>> GetMenuAsync(
        BotIdentity identity,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotMenuResponse>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        var dateWindow = attendanceDatePolicy.GetWindow(user.Role);
        return BotApiResult<BotMenuResponse>.Success(new BotMenuResponse(
            MapUserContext(user, identity),
            new BotAttendanceDateWindow(dateWindow.Today, dateWindow.MinTrainingDate, dateWindow.MaxTrainingDate),
            GetMenuItems(user.Role)));
    }

    public async Task<BotApiResult<IReadOnlyList<BotAttendanceGroup>>> ListAttendanceGroupsAsync(
        BotIdentity identity,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<IReadOnlyList<BotAttendanceGroup>>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!UserRoleAuthorizationPolicy.HasCapability(user.Role, CrmCapability.MarkAttendance))
        {
            return BotApiResult<IReadOnlyList<BotAttendanceGroup>>.Failure(BotApiError.Forbidden);
        }

        var accessScope = await accessScopeService.GetAccessScopeAsync(user, cancellationToken);
        var accessibleGroupIds = accessScope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : accessScope.AttendanceScope.GroupIds.ToHashSet();

        var query = dbContext.TrainingGroups.AsNoTracking();
        if (accessibleGroupIds is not null)
        {
            query = query.Where(group => accessibleGroupIds.Contains(group.Id));
        }

        var groups = await query
            .OrderBy(group => group.IsActive ? 0 : 1)
            .ThenBy(group => group.Name)
            .ThenBy(group => group.TrainingStartTime)
            .ThenBy(group => group.Id)
            .Select(group => new BotAttendanceGroup(
                group.Id,
                group.Name,
                group.BranchId,
                group.Branch.Name,
                group.HallId,
                group.Hall.Name,
                group.TrainingStartTime.ToString("HH\\:mm"),
                group.DurationMinutes,
                group.Weekdays,
                group.IsActive,
                group.Clients.Count(clientGroup => clientGroup.Client.Status == ClientStatus.Active)))
            .ToArrayAsync(cancellationToken);

        return BotApiResult<IReadOnlyList<BotAttendanceGroup>>.Success(groups);
    }

    public async Task<BotApiResult<IReadOnlyList<BotAttendanceLesson>>> ListAttendanceLessonsAsync(
        BotIdentity identity,
        DateOnly trainingDate,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<IReadOnlyList<BotAttendanceLesson>>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!UserRoleAuthorizationPolicy.HasCapability(user.Role, CrmCapability.MarkAttendance))
        {
            return BotApiResult<IReadOnlyList<BotAttendanceLesson>>.Failure(BotApiError.Forbidden);
        }

        var series = await LoadAccessibleSeriesAsync(user, trainingDate, trainingDate, cancellationToken);
        var weekday = ToIsoWeekday(trainingDate);
        var canEdit = attendanceDatePolicy.IsAllowed(user.Role, trainingDate);
        var lessons = series
            .SelectMany(item => item.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= trainingDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= trainingDate))
                .SelectMany(version => version.Slots
                    .Where(slot => slot.IsoWeekday == weekday)
                    .Select(slot => new { Series = item, Slot = slot })))
            .OrderBy(item => item.Slot.StartTime)
            .ThenBy(item => item.Series.Group.Name)
            .ThenBy(item => item.Slot.Id)
            .Select(item => new BotAttendanceLesson(
                LessonOccurrenceIdPolicy.CreateRecurring(item.Slot.SlotLineageId, trainingDate),
                trainingDate,
                item.Series.GroupId,
                item.Series.Group.Name,
                item.Slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                item.Slot.DurationMinutes,
                item.Slot.Hall.Name,
                item.Series.Group.Branch.Name,
                MapEffectiveTrainerNames(item.Series.Group, trainingDate)
                    .ToArray(),
                "Scheduled",
                true,
                canEdit))
            .ToList();
        if (user.Role == UserRole.Coach)
        {
            var projectedIds = lessons.Select(lesson => lesson.LessonOccurrenceId).ToHashSet();
            var substitutedOccurrences = await dbContext.LessonOccurrences
                .AsNoTracking()
                .Where(occurrence =>
                    occurrence.LessonDate == trainingDate &&
                    occurrence.TrainerSubstitutions.Any(substitution =>
                        substitution.SubstituteTrainerId == user.Id &&
                        substitution.CancelledAt == null))
                .Include(occurrence => occurrence.Group)
                    .ThenInclude(group => group.Branch)
                .Include(occurrence => occurrence.Group)
                    .ThenInclude(group => group.TrainerAssignments)
                        .ThenInclude(assignment => assignment.Trainer)
                .Include(occurrence => occurrence.Hall)
                .Include(occurrence => occurrence.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                    .ThenInclude(substitution => substitution.SubstituteTrainer)
                .AsSplitQuery()
                .ToArrayAsync(cancellationToken);
            lessons.AddRange(substitutedOccurrences
                .Where(occurrence => !projectedIds.Contains(occurrence.Id))
                .Select(occurrence => new BotAttendanceLesson(
                    occurrence.Id,
                    occurrence.LessonDate,
                    occurrence.GroupId,
                    occurrence.Group.Name,
                    occurrence.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                    occurrence.DurationMinutes,
                    occurrence.Hall.Name,
                    occurrence.Group.Branch.Name,
                    MapEffectiveTrainerNames(occurrence.Group, occurrence.LessonDate, occurrence.TrainerSubstitutions)
                        .ToArray(),
                    occurrence.Status.ToString(),
                    true,
                    canEdit)));
        }

        return BotApiResult<IReadOnlyList<BotAttendanceLesson>>.Success(lessons
            .OrderBy(lesson => lesson.StartTime, StringComparer.Ordinal)
            .ThenBy(lesson => lesson.GroupName, StringComparer.CurrentCulture)
            .ThenBy(lesson => lesson.LessonOccurrenceId)
            .ToArray());
    }

    public async Task<BotApiResult<BotAttendanceRoster>> GetAttendanceRosterAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken)
    {
        return await GetAttendanceRosterCoreAsync(identity, groupId, trainingDate, cancellationToken, null, false);
    }

    public async Task<BotApiResult<BotAttendanceRoster>> GetAttendanceRosterAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken,
        Guid? lessonOccurrenceId)
    {
        return await GetAttendanceRosterCoreAsync(identity, groupId, trainingDate, cancellationToken, lessonOccurrenceId, false);
    }

    private async Task<BotApiResult<BotAttendanceRoster>> GetAttendanceRosterCoreAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken,
        Guid? lessonOccurrenceId,
        bool occurrenceScopeAccessAllowed = false)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotAttendanceRoster>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!UserRoleAuthorizationPolicy.HasCapability(user.Role, CrmCapability.MarkAttendance))
        {
            return BotApiResult<BotAttendanceRoster>.Failure(BotApiError.Forbidden);
        }

        if (!attendanceDatePolicy.IsAllowed(user.Role, trainingDate))
        {
            return BotApiResult<BotAttendanceRoster>.Failure(BotApiError.InvalidAttendanceDate);
        }

        var groupAccess = await GetAccessibleGroupAsync(user, groupId, cancellationToken);
        if (groupAccess.Error.HasValue && !occurrenceScopeAccessAllowed)
        {
            return BotApiResult<BotAttendanceRoster>.Failure(groupAccess.Error.Value);
        }

        var group = groupAccess.Group ?? await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == groupId, cancellationToken);
        var effectiveGroupIds = user.Role == UserRole.Coach
            ? (IReadOnlyList<Guid>)(await accessScopeService.GetAccessScopeAsync(user, cancellationToken)).AssignedGroupIds
                .Append(occurrenceScopeAccessAllowed ? groupId : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToArray()
            : null;
        var clients = await dbContext.Clients
            .AsNoTracking()
            .Where(client =>
                client.Status == ClientStatus.Active &&
                client.Groups.Any(clientGroup => clientGroup.GroupId == groupId))
            .Include(client => client.Branch)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.TargetGroups)
                    .ThenInclude(target => target.Group)
                        .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .Include(client => client.AttendanceEntries)
            .AsSplitQuery()
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id)
            .ToArrayAsync(cancellationToken);

        var entitlementByClientId = new Dictionary<Guid, ClientMembershipEntitlementResolution>();
        foreach (var client in clients)
        {
            entitlementByClientId[client.Id] = await entitlementResolver.ResolveAsync(
                client.Id,
                groupId,
                trainingDate,
                cancellationToken);
        }

        return BotApiResult<BotAttendanceRoster>.Success(new BotAttendanceRoster(
            group.Id,
            group.Name,
            trainingDate,
            MapDateWindow(user.Role),
            clients
                .Select(client => MapAttendanceClient(
                    client,
                    user,
                    effectiveGroupIds,
                    lessonOccurrenceId ?? LessonOccurrenceIdPolicy.CreateLegacyAttendance(groupId, trainingDate),
                    groupId,
                    trainingDate,
                    businessDateProvider.Today,
                    entitlementByClientId[client.Id]))
                .ToArray()));
    }

    public async Task<BotApiResult<BotAttendanceRoster>> GetAttendanceRosterByLessonAsync(
        BotIdentity identity,
        Guid lessonOccurrenceId,
        DateOnly lessonDate,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveProjectedLessonAsync(
            identity,
            lessonOccurrenceId,
            lessonDate,
            cancellationToken);

        return resolved.Error.HasValue
            ? BotApiResult<BotAttendanceRoster>.Failure(resolved.Error.Value)
            : await GetAttendanceRosterCoreAsync(
                identity,
                resolved.GroupId,
                lessonDate,
                cancellationToken,
                lessonOccurrenceId,
                resolved.IsOccurrenceScopedAccess);
    }

    public async Task<BotApiResult<BotAttendanceSaveResponse>> SaveAttendanceAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        IReadOnlyList<BotAttendanceMarkInput> marks,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        return await SaveAttendanceCoreAsync(
            identity,
            groupId,
            trainingDate,
            marks,
            idempotencyKey,
            payloadJson,
            cancellationToken,
            null,
            false);
    }

    private async Task<BotApiResult<BotAttendanceSaveResponse>> SaveAttendanceCoreAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        IReadOnlyList<BotAttendanceMarkInput> marks,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken,
        Guid? lessonOccurrenceId,
        bool occurrenceScopeAccessAllowed)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!UserRoleAuthorizationPolicy.HasCapability(user.Role, CrmCapability.MarkAttendance))
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.Forbidden);
        }

        if (!attendanceDatePolicy.IsAllowed(user.Role, trainingDate))
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.InvalidAttendanceDate);
        }

        if (marks.Count == 0)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
            {
                ["attendanceMarks"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine40083588c51]
            });
        }

        var groupAccess = await GetAccessibleGroupAsync(user, groupId, cancellationToken);
        if (groupAccess.Error.HasValue && !occurrenceScopeAccessAllowed)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(groupAccess.Error.Value);
        }

        var group = groupAccess.Group ?? await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == groupId, cancellationToken);
        var reservation = await idempotencyService.ReserveAsync<BotAttendanceSaveResponse>(
            identity,
            BotAuditConstants.BotAttendanceSavedAction,
            idempotencyKey,
            payloadJson,
            cancellationToken);

        if (reservation.State == BotIdempotencyService.ReservationState.Replay)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Success(reservation.Response!);
        }

        if (reservation.State == BotIdempotencyService.ReservationState.Conflict)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.IdempotencyConflict);
        }

        var recordId = reservation.RecordId!.Value;
        try
        {
            var mutationResult = await attendanceService.SaveAsync(
                new SaveAttendanceCommand(
                    lessonOccurrenceId ?? LessonOccurrenceIdPolicy.CreateLegacyAttendance(groupId, trainingDate),
                    groupId,
                    trainingDate,
                    user.Id,
                    user.Login,
                    new AttendanceAuditContext(
                        "Bot",
                        identity.Platform,
                        BotHashing.ComputeSha256(identity.PlatformUserId)),
                    marks.Select(mark => new AttendanceMarkCommand(
                        mark.ClientId,
                        mark.IsPresent ? AttendanceState.Present : AttendanceState.Absent)).ToArray()),
                cancellationToken);

            if (!mutationResult.Succeeded)
            {
                await idempotencyService.ReleaseAsync(recordId, cancellationToken);

                return mutationResult.Error switch
                {
                    AttendanceBatchMutationError.GroupMissing => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.NotFound),
                    AttendanceBatchMutationError.LessonOccurrenceMissing => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.NotFound),
                    AttendanceBatchMutationError.ClientOutsideGroup => BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
                    {
                        ["attendanceMarks"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine459459f4ac6]
                    }),
                    AttendanceBatchMutationError.TrainingDateInFuture => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.InvalidAttendanceDate),
                    AttendanceBatchMutationError.TrainingDateUnavailable => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.InvalidAttendanceDate),
                    AttendanceBatchMutationError.Forbidden => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.Forbidden),
                    AttendanceBatchMutationError.LessonOccurrenceUnavailable => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.InvalidAttendanceDate),
                    AttendanceBatchMutationError.SingleVisitRestoreConflict => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.SingleVisitRestoreConflict),
                    AttendanceBatchMutationError.MembershipEntitlementInvariantConflict => BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
                    {
                        ["attendanceMarks"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine468b0e5ed19]
                    }),
                    _ => BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
                    {
                        ["attendanceMarks"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine47244fbf4c2]
                    })
                };
            }

            var details = mutationResult.Details!;
            var warningClients = await dbContext.Clients
                .AsNoTracking()
                .Where(client => marks.Select(mark => mark.ClientId).Contains(client.Id))
                .ToArrayAsync(cancellationToken);

            var warningItems = new List<BotAttendanceClientWarning>();
            foreach (var client in warningClients)
            {
                var entitlement = await entitlementResolver.ResolveAsync(
                    client.Id,
                    groupId,
                    trainingDate,
                    cancellationToken);
                var message = entitlement.Status switch
                {
                    ClientMembershipEntitlementResolutionStatus.NoEntitlement =>
                        global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine494ef2f1afb,
                    ClientMembershipEntitlementResolutionStatus.InvariantConflict =>
                        global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine496b0e5ed19,
                    _ => null
                };
                if (message is not null)
                {
                    warningItems.Add(new BotAttendanceClientWarning(
                        client.Id,
                        BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                        message));
                }
            }

            var warnings = warningItems
                .OrderBy(item => item.FullName, StringComparer.CurrentCulture)
                .ThenBy(item => item.ClientId)
                .ToArray();

            var response = new BotAttendanceSaveResponse(
                group.Id,
                group.Name,
                trainingDate,
                MapDateWindow(user.Role),
                marks.Count,
                marks.Count(mark => mark.IsPresent),
                marks.Count(mark => !mark.IsPresent),
                warnings);

            await WriteBotAuditAsync(
                user,
                identity,
                BotAuditConstants.BotAttendanceSavedAction,
                "Attendance",
                groupId.ToString(),
                global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine529be3a74eb(user.Login, group.Name, trainingDate.ToString(DateFormat, CultureInfo.InvariantCulture)),
                null,
                JsonSerializer.Serialize(response, SerializerOptions),
                cancellationToken);

            await idempotencyService.CompleteAsync(recordId, response, cancellationToken);

            return BotApiResult<BotAttendanceSaveResponse>.Success(response);
        }
        catch
        {
            await idempotencyService.ReleaseAsync(recordId, CancellationToken.None);
            throw;
        }
    }

    public async Task<BotApiResult<BotAttendanceSaveResponse>> SaveAttendanceByLessonAsync(
        BotIdentity identity,
        Guid lessonOccurrenceId,
        DateOnly lessonDate,
        IReadOnlyList<BotAttendanceMarkInput> marks,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveProjectedLessonAsync(
            identity,
            lessonOccurrenceId,
            lessonDate,
            cancellationToken);

        return resolved.Error.HasValue
            ? BotApiResult<BotAttendanceSaveResponse>.Failure(resolved.Error.Value)
            : await SaveAttendanceCoreAsync(
                identity,
                resolved.GroupId,
                lessonDate,
                marks,
                idempotencyKey,
                payloadJson,
                cancellationToken,
                lessonOccurrenceId,
                resolved.IsOccurrenceScopedAccess);
    }

    public async Task<BotApiResult<BotClientSearchResponse>> SearchClientsAsync(
        BotIdentity identity,
        string? query,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotClientSearchResponse>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (skip < 0 || take <= 0 || take > MaxSearchTake)
        {
            return BotApiResult<BotClientSearchResponse>.Validation(new Dictionary<string, string[]>
            {
                ["paging"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine592bd0975b8(MaxSearchTake)]
            });
        }

        var baseQuery = dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active);

        IReadOnlyList<Guid>? effectiveGroupIds = null;
        if (user.Role == UserRole.Coach)
        {
            effectiveGroupIds = (await accessScopeService.GetAccessScopeAsync(user, cancellationToken)).AssignedGroupIds;
            baseQuery = ApplyCoachClientScope(baseQuery, effectiveGroupIds);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var byName = ApplyFullNameSearch(baseQuery, query);
            if (UserRoleAuthorizationPolicy.GetOperationalScopeKind(user.Role) != AccessScopeKind.AssignedGroups)
            {
                var byPhone = ApplyPhoneSearch(baseQuery, query);
                baseQuery = byName.Union(byPhone);
            }
            else
            {
                baseQuery = byName;
            }
        }

        var clients = await baseQuery
            .Include(client => client.Branch)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.TargetGroups)
                    .ThenInclude(target => target.Group)
                        .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .AsSplitQuery()
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id)
            .Skip(skip)
            .Take(take + 1)
            .ToArrayAsync(cancellationToken);

        var hasMore = clients.Length > take;
        var pageItems = hasMore ? clients.Take(take).ToArray() : clients;
        var today = businessDateProvider.Today;

        return BotApiResult<BotClientSearchResponse>.Success(new BotClientSearchResponse(
            pageItems
                .Select(client => MapClientListItem(client, user, effectiveGroupIds, today))
                .ToArray(),
            skip,
            take,
            hasMore));
    }

    public async Task<BotApiResult<BotClientCard>> GetClientCardAsync(
        BotIdentity identity,
        Guid clientId,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotClientCard>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        var client = await dbContext.Clients
            .AsNoTracking()
            .Include(currentClient => currentClient.Branch)
            .Include(currentClient => currentClient.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(currentClient => currentClient.Memberships)
                .ThenInclude(membership => membership.Sale)
            .Include(currentClient => currentClient.Memberships)
                .ThenInclude(membership => membership.TargetGroups)
                    .ThenInclude(target => target.Group)
                        .ThenInclude(group => group.Branch)
            .Include(currentClient => currentClient.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .Include(currentClient => currentClient.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(currentClient => currentClient.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .AsSplitQuery()
            .SingleOrDefaultAsync(candidate => candidate.Id == clientId, cancellationToken);

        if (client is null)
        {
            return BotApiResult<BotClientCard>.Failure(BotApiError.NotFound);
        }

        var allowedGroupIds = user.Role == UserRole.Coach
            ? (await accessScopeService.GetAccessScopeAsync(user, cancellationToken)).AssignedGroupIds
            : null;

        if (user.Role == UserRole.Coach &&
            (allowedGroupIds is null ||
             !client.Groups.Any(clientGroup => allowedGroupIds.Contains(clientGroup.GroupId))))
        {
            return BotApiResult<BotClientCard>.Failure(BotApiError.Forbidden);
        }

        var attendanceHistoryQuery = dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => attendance.ClientId == clientId);

        if (allowedGroupIds is { Count: > 0 })
        {
            attendanceHistoryQuery = attendanceHistoryQuery
                .Where(attendance => allowedGroupIds.Contains(attendance.GroupId));
        }

        var attendanceHistory = await attendanceHistoryQuery
            .OrderByDescending(attendance => attendance.TrainingDate)
            .ThenByDescending(attendance => attendance.UpdatedAt)
            .ThenByDescending(attendance => attendance.Id)
            .Take(ClientCardAttendanceTake)
            .Select(attendance => new BotAttendanceHistoryItem(
                attendance.TrainingDate,
                attendance.IsPresent,
                attendance.GroupId,
                attendance.Group.Name))
            .ToArrayAsync(cancellationToken);

        var today = businessDateProvider.Today;
        return BotApiResult<BotClientCard>.Success(MapClientCard(client, user, allowedGroupIds, today, attendanceHistory));
    }

    public async Task<BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>> ListExpiringMembershipsAsync(
        BotIdentity identity,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!UserRoleAuthorizationPolicy.HasCapability(user.Role, CrmCapability.ManageClients))
        {
            return BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>.Failure(BotApiError.Forbidden);
        }

        var today = businessDateProvider.Today;
        var expiresBefore = today.AddDays(ClientMembershipQueryConstants.ExpiringMembershipWindowDays);

        var items = await dbContext.ClientMemberships
            .AsNoTracking()
            .Where(membership =>
                membership.Client.Status == ClientStatus.Active &&
                membership.ValidTo == null &&
                membership.BehaviorKind != MembershipBehaviorKind.Professional &&
                membership.IndividualValidTo.HasValue &&
                membership.IndividualValidTo.Value >= today &&
                membership.IndividualValidTo.Value < expiresBefore)
            .Select(membership => new
            {
                ClientId = membership.ClientId,
                MembershipId = membership.Id,
                membership.SaleId,
                membership.Client.LastName,
                membership.Client.FirstName,
                membership.Client.MiddleName,
                membership.BehaviorKind,
                MembershipLabel = membership.Sale.MembershipCatalogItem != null
                    ? membership.Sale.MembershipCatalogItem.Name
                    : ClientMembershipSaleDisplay.AmountOnlyLabel,
                ExpirationDate = membership.IndividualValidTo!.Value,
                TargetGroups = membership.TargetGroups
                    .OrderBy(target => target.Position)
                    .Select(target => new BotClientMembershipTarget(
                        target.GroupId,
                        target.Group.Name,
                        target.BranchId,
                        target.Group.Branch.Name,
                        target.Position,
                        target.Group.IsActive))
                    .ToArray()
            })
            .OrderBy(candidate => candidate.ExpirationDate)
            .ThenBy(candidate => candidate.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.ClientId)
            .ThenBy(candidate => candidate.MembershipId)
            .Select(candidate => new BotExpiringMembershipListItem(
                candidate.ClientId,
                candidate.MembershipId,
                candidate.SaleId,
                BuildClientFullName(candidate.LastName, candidate.FirstName, candidate.MiddleName),
                candidate.BehaviorKind.ToString(),
                candidate.MembershipLabel,
                candidate.ExpirationDate,
                candidate.ExpirationDate.DayNumber - today.DayNumber,
                candidate.TargetGroups))
            .ToArrayAsync(cancellationToken);

        return BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>.Success(items);
    }

    public async Task<BotApiResult<BotAccessDeniedAuditResponse>> WriteAccessDeniedAuditAsync(
        BotIdentity identity,
        BotAccessDeniedAuditRequest request,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotAccessDeniedAuditResponse>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (string.IsNullOrWhiteSpace(request.ActionCode))
        {
            return BotApiResult<BotAccessDeniedAuditResponse>.Validation(new Dictionary<string, string[]>
            {
                ["actionCode"] = [global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.BotApiServiceLine832C2fbee88]
            });
        }

        var reservation = await idempotencyService.ReserveAsync<BotAccessDeniedAuditResponse>(
            identity,
            BotAuditConstants.BotAccessDeniedAction,
            idempotencyKey,
            payloadJson,
            cancellationToken);

        if (reservation.State == BotIdempotencyService.ReservationState.Replay)
        {
            return BotApiResult<BotAccessDeniedAuditResponse>.Success(reservation.Response!);
        }

        if (reservation.State == BotIdempotencyService.ReservationState.Conflict)
        {
            return BotApiResult<BotAccessDeniedAuditResponse>.Failure(BotApiError.IdempotencyConflict);
        }

        var recordId = reservation.RecordId!.Value;

        var response = new BotAccessDeniedAuditResponse(true);

        await WriteBotAuditAsync(
            user,
            identity,
            BotAuditConstants.BotAccessDeniedAction,
            string.IsNullOrWhiteSpace(request.EntityType) ? "BotAction" : request.EntityType.Trim(),
            string.IsNullOrWhiteSpace(request.EntityId) ? null : request.EntityId.Trim(),
            global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine863f0c57b5b(user.Login, request.ActionCode.Trim()),
            null,
            JsonSerializer.Serialize(request, SerializerOptions),
            cancellationToken);

        await idempotencyService.CompleteAsync(recordId, response, cancellationToken);

        return BotApiResult<BotAccessDeniedAuditResponse>.Success(response);
    }

    private async Task<BotApiResult<User>> ResolveUserAsync(
        BotIdentity identity,
        CancellationToken cancellationToken)
    {
        var normalizedIdentity = NormalizeIdentity(identity);
        if (normalizedIdentity.ValidationErrors is { Count: > 0 })
        {
            return BotApiResult<User>.Validation(normalizedIdentity.ValidationErrors);
        }

        var platformUserId = normalizedIdentity.PlatformUserId!;
        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate =>
                candidate.MessengerPlatform == MessengerPlatform.Telegram &&
                candidate.MessengerPlatformUserId == platformUserId,
                cancellationToken);

        if (user is null)
        {
            return BotApiResult<User>.Failure(BotApiError.UnknownUser);
        }

        if (!user.IsActive)
        {
            return BotApiResult<User>.Failure(BotApiError.UserInactive);
        }

        if (user.MustChangePassword)
        {
            return BotApiResult<User>.Failure(BotApiError.PasswordChangeRequired);
        }

        return BotApiResult<User>.Success(user);
    }

    private async Task<GroupAccessResult> GetAccessibleGroupAsync(
        User user,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == groupId, cancellationToken);

        if (group is null)
        {
            return GroupAccessResult.NotFound();
        }

        var accessDecision = await accessScopeService.EvaluateGroupAccessAsync(user, groupId, cancellationToken);
        if (accessDecision == GroupAccessDecision.GroupNotFound)
        {
            return GroupAccessResult.NotFound();
        }

        if (accessDecision == GroupAccessDecision.Forbidden)
        {
            return GroupAccessResult.Forbidden();
        }

        return GroupAccessResult.Allowed(group);
    }

    private async Task<IReadOnlyList<TrainingGroup>> LoadAccessibleGroupsAsync(
        User user,
        CancellationToken cancellationToken)
    {
        var accessScope = await accessScopeService.GetAccessScopeAsync(user, cancellationToken);
        var accessibleGroupIds = accessScope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : accessScope.AttendanceScope.GroupIds.ToHashSet();

        var query = dbContext.TrainingGroups
            .AsNoTracking()
            .Include(group => group.Branch)
            .Include(group => group.Hall)
            .Include(group => group.Trainers)
                .ThenInclude(trainer => trainer.Trainer)
            .AsSplitQuery();
        if (accessibleGroupIds is not null)
        {
            query = query.Where(group => accessibleGroupIds.Contains(group.Id));
        }

        return await query
            .OrderBy(group => group.Name)
            .ThenBy(group => group.Id)
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<LessonSeries>> LoadAccessibleSeriesAsync(
        User user,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        var accessScope = await accessScopeService.GetAccessScopeAsync(user, cancellationToken);
        var accessibleGroupIds = accessScope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : accessScope.AttendanceScope.GroupIds.ToHashSet();

        var query = dbContext.LessonSeries
            .AsNoTracking()
            .Where(series =>
                series.StartsOn <= to &&
                (series.EndsOn == null || series.EndsOn >= from))
            .Include(series => series.Group)
                .ThenInclude(group => group.Branch)
            .Include(series => series.Group)
                .ThenInclude(group => group.TrainerAssignments)
                    .ThenInclude(assignment => assignment.Trainer)
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery();
        if (accessibleGroupIds is not null)
        {
            query = query.Where(series => accessibleGroupIds.Contains(series.GroupId));
        }

        return await query
            .OrderBy(series => series.Group.Name)
            .ThenBy(series => series.GroupId)
            .ToArrayAsync(cancellationToken);
    }

    private async Task<LessonResolutionResult> ResolveProjectedLessonAsync(
        BotIdentity identity,
        Guid lessonOccurrenceId,
        DateOnly lessonDate,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return LessonResolutionResult.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!UserRoleAuthorizationPolicy.HasCapability(user.Role, CrmCapability.MarkAttendance))
        {
            return LessonResolutionResult.Failure(BotApiError.Forbidden);
        }

        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence => occurrence.Id == lessonOccurrenceId && occurrence.LessonDate == lessonDate)
            .Select(occurrence => new
            {
                occurrence.GroupId,
                IsOccurrenceScopedAccess = occurrence.TrainerSubstitutions.Any(substitution =>
                    substitution.SubstituteTrainerId == user.Id &&
                    substitution.CancelledAt == null)
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (materialized is not null)
        {
            var access = await accessScopeService.EvaluateGroupAccessAsync(user, materialized.GroupId, cancellationToken);
            return access == GroupAccessDecision.Allowed || materialized.IsOccurrenceScopedAccess
                ? LessonResolutionResult.Success(
                    materialized.GroupId,
                    access != GroupAccessDecision.Allowed && materialized.IsOccurrenceScopedAccess)
                : LessonResolutionResult.Failure(BotApiError.NotFound);
        }

        var weekday = ToIsoWeekday(lessonDate);
        var series = await LoadAccessibleSeriesAsync(user, lessonDate, lessonDate, cancellationToken);
        var groupId = series
            .SelectMany(item => item.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= lessonDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= lessonDate))
                .SelectMany(version => version.Slots
                    .Where(slot => slot.IsoWeekday == weekday)
                    .Where(slot => LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, lessonDate) == lessonOccurrenceId)
                    .Select(_ => (Guid?)item.GroupId)))
            .SingleOrDefault();

        return groupId is null
            ? LessonResolutionResult.Failure(BotApiError.NotFound)
            : LessonResolutionResult.Success(groupId.Value, false);
    }

    private static IEnumerable<string> MapEffectiveTrainerNames(
        TrainingGroup group,
        DateOnly lessonDate,
        IEnumerable<LessonOccurrenceTrainerSubstitution>? substitutions = null)
    {
        var activeSubstitutions = substitutions?
            .Where(substitution => substitution.CancelledAt == null)
            .GroupBy(substitution => substitution.ReplacedTrainerId)
            .Select(grouping => grouping.OrderBy(substitution => substitution.CreatedAt).ThenBy(substitution => substitution.Id).First())
            .ToDictionary(substitution => substitution.ReplacedTrainerId)
            ?? new Dictionary<Guid, LessonOccurrenceTrainerSubstitution>();

        return group.TrainerAssignments
            .Where(assignment =>
                assignment.ValidFrom <= lessonDate &&
                (assignment.ValidTo is null || assignment.ValidTo >= lessonDate) &&
                !activeSubstitutions.ContainsKey(assignment.TrainerId))
            .Select(assignment => assignment.Trainer.FullName)
            .Concat(activeSubstitutions.Values.Select(substitution => substitution.SubstituteTrainer.FullName))
            .OrderBy(name => name, StringComparer.CurrentCulture)
            .ThenBy(name => name, StringComparer.Ordinal);
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private async Task WriteBotAuditAsync(
        User user,
        BotIdentity identity,
        string actionType,
        string entityType,
        string? entityId,
        string description,
        string? oldValueJson,
        string? newValueJson,
        CancellationToken cancellationToken)
    {
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                user.Id,
                actionType,
                entityType,
                entityId,
                description,
                oldValueJson,
                newValueJson,
                AuditSource.Bot,
                BotAuditConstants.TelegramPlatform,
                BotHashing.ComputeSha256(identity.PlatformUserId)),
            cancellationToken);
    }

    private static BotUserContext MapUserContext(User user, BotIdentity identity)
    {
        return new BotUserContext(
            user.Id,
            user.FullName,
            user.Login,
            user.Role.ToString(),
            identity.Platform.Trim(),
            identity.PlatformUserId.Trim());
    }

    private static IReadOnlyList<BotMenuItem> GetMenuItems(UserRole role)
    {
        return role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator =>
            [
                new BotMenuItem("attendance", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine11285f43e5f1),
                new BotMenuItem("client_search", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1129f9344282),
                new BotMenuItem("expiring_memberships", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine113081484e50)
            ],
            UserRole.Administrator =>
            [
                new BotMenuItem("attendance", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine11345f43e5f1),
                new BotMenuItem("client_search", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1135f9344282),
                new BotMenuItem("expiring_memberships", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine113681484e50)
            ],
            UserRole.Coach =>
            [
                new BotMenuItem("attendance", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine11405f43e5f1),
                new BotMenuItem("client_search", global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1141f9344282)
            ],
            _ => []
        };
    }

    private static NormalizedIdentity NormalizeIdentity(BotIdentity identity)
    {
        var errors = new Dictionary<string, string[]>();
        var platform = identity.Platform?.Trim();
        var platformUserId = identity.PlatformUserId?.Trim();

        if (!string.Equals(platform, BotAuditConstants.TelegramPlatform, StringComparison.OrdinalIgnoreCase))
        {
            errors["platform"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine11554f342e03];
        }

        if (string.IsNullOrWhiteSpace(platformUserId))
        {
            errors["platformUserId"] = [global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1160b06268ca];
        }

        return new NormalizedIdentity(
            string.IsNullOrWhiteSpace(platform) ? null : platform,
            string.IsNullOrWhiteSpace(platformUserId) ? null : platformUserId,
            errors.Count == 0 ? null : errors);
    }

    private BotAttendanceDateWindow MapDateWindow(UserRole role)
    {
        var window = attendanceDatePolicy.GetWindow(role);
        return new BotAttendanceDateWindow(window.Today, window.MinTrainingDate, window.MaxTrainingDate);
    }

    private static IQueryable<Client> ApplyCoachClientScope(
        IQueryable<Client> query,
        IReadOnlyCollection<Guid> effectiveGroupIds)
    {
        return query.Where(client => client.Groups.Any(clientGroup => effectiveGroupIds.Contains(clientGroup.GroupId)));
    }

    private static IQueryable<Client> ApplyFullNameSearch(IQueryable<Client> query, string fullName)
    {
        var searchTerms = fullName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(term => term.ToUpperInvariant())
            .Where(term => term.Length > 0)
            .ToArray();

        foreach (var searchTerm in searchTerms)
        {
            query = query.Where(client =>
                (client.LastName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (client.FirstName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (client.MiddleName ?? string.Empty).ToUpper().Contains(searchTerm));
        }

        return query;
    }

    private static IQueryable<Client> ApplyPhoneSearch(IQueryable<Client> query, string phone)
    {
        var normalizedPhone = NormalizePhoneSearch(phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
        {
            return query.Where(_ => false);
        }

        return query.Where(client =>
            client.Phone != null &&
            client.Phone
                .Replace(" ", string.Empty)
                .Replace("-", string.Empty)
                .Replace("(", string.Empty)
                .Replace(")", string.Empty)
                .Replace("+", string.Empty)
                .Contains(normalizedPhone));
    }

    private static string NormalizePhoneSearch(string phone)
    {
        return phone
            .Trim()
            .Replace(" ", string.Empty)
            .Replace("-", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty)
            .Replace("+", string.Empty);
    }

    private static BotAttendanceClient MapAttendanceClient(
        Client client,
        User currentUser,
        IReadOnlyCollection<Guid>? effectiveGroupIds,
        Guid lessonOccurrenceId,
        Guid groupId,
        DateOnly trainingDate,
        DateOnly businessDate,
        ClientMembershipEntitlementResolution entitlement)
    {
        var entitlementMembership = entitlement.MembershipId.HasValue
            ? client.Memberships.SingleOrDefault(membership => membership.Id == entitlement.MembershipId.Value)
            : null;
        var visibleGroups = currentUser.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => effectiveGroupIds?.Contains(clientGroup.GroupId) == true)
            : client.Groups.AsEnumerable();
        var isProfessional = entitlement is
        {
            Status: ClientMembershipEntitlementResolutionStatus.Found,
            BehaviorKind: MembershipBehaviorKind.Professional
        };
        var warning = entitlement.Status switch
        {
            ClientMembershipEntitlementResolutionStatus.InvariantConflict =>
                new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1255b0e5ed19),
            ClientMembershipEntitlementResolutionStatus.NoEntitlement =>
                new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1257ef2f1afb),
            _ => new MembershipWarningResult(false, null)
        };
        var isPresent = client.AttendanceEntries.Any(attendance =>
            attendance.LessonOccurrenceId == lessonOccurrenceId &&
            attendance.IsPresent);

        return new BotAttendanceClient(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.BranchId,
            client.Branch.Name,
            MapGroups(visibleGroups),
            MapPhoto(client),
            isPresent,
            isProfessional,
            isProfessional ? entitlementMembership?.ProfessionalComment : null,
            warning.HasWarning,
            warning.Message,
            entitlement.Status == ClientMembershipEntitlementResolutionStatus.Found);
    }

    private static BotClientListItem MapClientListItem(
        Client client,
        User user,
        IReadOnlyCollection<Guid>? effectiveGroupIds,
        DateOnly trainingDate)
    {
        var currentMemberships = GetCurrentMemberships(client);
        var professionalMembership = currentMemberships
            .SingleOrDefault(membership =>
                membership.BehaviorKind == MembershipBehaviorKind.Professional &&
                ClientMembershipTargetPolicy.ResolveEntitlementState(membership, trainingDate) ==
                ClientMembershipEntitlementState.Active);
        var isProfessional = professionalMembership is not null;
        var warning = EvaluateMembershipWarning(currentMemberships, trainingDate);
        var singleMembership = currentMemberships.Count == 1 ? currentMemberships[0] : null;
        var groups = user.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => effectiveGroupIds?.Contains(clientGroup.GroupId) == true)
            : client.Groups.AsEnumerable();

        return new BotClientListItem(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            user.Role == UserRole.Coach ? null : client.Phone,
            client.BranchId,
            client.Branch.Name,
            client.Status.ToString(),
            MapGroups(groups),
            MapPhoto(client),
            isProfessional,
            professionalMembership?.ProfessionalComment,
            warning.HasWarning,
            warning.Message,
            currentMemberships.Any(membership =>
                ClientMembershipTargetPolicy.ResolveEntitlementState(membership, trainingDate) ==
                ClientMembershipEntitlementState.Active),
            singleMembership?.BehaviorKind.ToString(),
            singleMembership is not null
                ? ClientMembershipSaleDisplay.GetMembershipName(singleMembership.Sale)
                : currentMemberships.Count > 1
                    ? global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1318d13b909e(currentMemberships.Count)
                    : null);
    }

    private static BotClientCard MapClientCard(
        Client client,
        User user,
        IReadOnlyCollection<Guid>? effectiveGroupIds,
        DateOnly trainingDate,
        IReadOnlyList<BotAttendanceHistoryItem> attendanceHistory)
    {
        var currentMemberships = GetCurrentMemberships(client);
        var professionalMembership = currentMemberships
            .SingleOrDefault(membership =>
                membership.BehaviorKind == MembershipBehaviorKind.Professional &&
                ClientMembershipTargetPolicy.ResolveEntitlementState(membership, trainingDate) ==
                ClientMembershipEntitlementState.Active);
        var isProfessional = professionalMembership is not null;
        var warning = EvaluateMembershipWarning(currentMemberships, trainingDate);
        var groups = user.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => effectiveGroupIds?.Contains(clientGroup.GroupId) == true)
            : client.Groups.AsEnumerable();

        return new BotClientCard(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            user.Role == UserRole.Coach ? null : client.Phone,
            client.BranchId,
            client.Branch.Name,
            client.Status.ToString(),
            MapGroups(groups),
            MapPhoto(client),
            isProfessional,
            professionalMembership?.ProfessionalComment,
            warning.HasWarning,
            warning.Message,
            currentMemberships.Any(membership =>
                ClientMembershipTargetPolicy.ResolveEntitlementState(membership, trainingDate) ==
                ClientMembershipEntitlementState.Active),
            user.Role == UserRole.Coach
                ? []
                : currentMemberships
                    .Select(membership => MapClientMembership(membership, trainingDate))
                    .ToArray(),
            attendanceHistory);
    }

    private static BotClientMembership MapClientMembership(ClientMembership membership, DateOnly businessDate)
    {
        return new BotClientMembership(
            membership.Id,
            membership.SaleId,
            membership.Sale.MembershipCatalogItemId,
            membership.BehaviorKind.ToString(),
            ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
            membership.Sale.PricingMode.ToString(),
            membership.Sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
            membership.Sale.PurchaseDate,
            membership.Sale.PaymentDate,
            membership.IndividualValidTo,
            membership.SingleVisitUsed,
            ClientMembershipTargetPolicy.ResolveCoverageKind(membership.BehaviorKind).ToString(),
            ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate).ToString(),
            membership.TargetGroups
                .OrderBy(target => target.Position)
                .Select(target => new BotClientMembershipTarget(
                    target.GroupId,
                    target.Group.Name,
                    target.BranchId,
                    target.Group.Branch.Name,
                    target.Position,
                    target.Group.IsActive))
                .ToArray());
    }

    private static IReadOnlyList<BotClientGroupSummary> MapGroups(IEnumerable<ClientGroup> groups)
    {
        return groups
            .Select(clientGroup => new BotClientGroupSummary(
                clientGroup.GroupId,
                clientGroup.Group.Name,
                clientGroup.Group.BranchId,
                clientGroup.Group.Branch.Name,
                clientGroup.Group.HallId,
                clientGroup.Group.Hall.Name,
                clientGroup.Group.IsActive,
                clientGroup.Group.TrainingStartTime.ToString("HH\\:mm"),
                clientGroup.Group.DurationMinutes,
                clientGroup.Group.Weekdays))
            .OrderBy(group => group.Name, StringComparer.CurrentCulture)
            .ThenBy(group => group.Id)
            .ToArray();
    }

    private static BotClientPhoto? MapPhoto(Client client)
    {
        if (string.IsNullOrWhiteSpace(client.PhotoPath) ||
            string.IsNullOrWhiteSpace(client.PhotoContentType) ||
            client.PhotoSizeBytes is null ||
            client.PhotoUploadedAt is null)
        {
            return null;
        }

        return new BotClientPhoto(
            client.PhotoPath,
            client.PhotoContentType,
            client.PhotoSizeBytes.Value,
            client.PhotoUploadedAt.Value,
            true);
    }

    private static MembershipWarningResult EvaluateMembershipWarning(
        IReadOnlyCollection<ClientMembership> memberships,
        DateOnly trainingDate)
    {
        if (memberships.Any(membership =>
                ClientMembershipTargetPolicy.ResolveEntitlementState(membership, trainingDate) ==
                ClientMembershipEntitlementState.Active))
        {
            return new MembershipWarningResult(false, null);
        }

        if (memberships.Count == 0)
        {
            return new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine14443ee05d1f);
        }

        var states = memberships
            .Select(membership => ClientMembershipTargetPolicy.ResolveEntitlementState(membership, trainingDate))
            .ToHashSet();
        if (states.Contains(ClientMembershipEntitlementState.LegacyTargetMissing))
        {
            return new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1452027fb5dc);
        }

        if (states.Contains(ClientMembershipEntitlementState.Future))
        {
            return new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1457cc00242d);
        }

        if (states.Contains(ClientMembershipEntitlementState.UsedSingleVisit))
        {
            return new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1462623985c4);
        }

        return new MembershipWarningResult(true, global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine14657fdd2e77);
    }

    private static IReadOnlyList<ClientMembership> GetCurrentMemberships(Client client)
    {
        return client.Memberships
            .Where(membership => membership.ValidTo is null)
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .ToArray();
    }

    private static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? global::GymCrm.Infrastructure.UserFacingText.BotText.BotApiServiceLine1487277d3a37
            : fullName;
    }

    private static string SerializeMembershipAuditState(ClientMembership membership)
    {
        return JsonSerializer.Serialize(
            new
            {
                membership.Id,
                membership.ClientId,
                membership.SaleId,
                membership.Sale.MembershipCatalogItemId,
                MembershipLabel = ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                BehaviorKind = membership.BehaviorKind.ToString(),
                PricingMode = membership.Sale.PricingMode.ToString(),
                membership.Sale.GrossAmount,
                CatalogPrice = ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
                membership.IndividualValidFrom,
                membership.IndividualValidTo,
                membership.ProfessionalComment,
                PurchaseDate = membership.Sale.PurchaseDate,
                PaymentDate = membership.Sale.PaymentDate,
                ExpirationDate = membership.IndividualValidTo,
                membership.SingleVisitUsed,
                PaymentRecordedByUserId = membership.Sale.CreatedByUserId,
                PaymentRecordedAt = membership.Sale.CreatedAt,
                ChangeReason = membership.ChangeReason.ToString(),
                membership.ChangedByUserId,
                membership.ValidFrom,
                membership.ValidTo,
                membership.CreatedAt
            },
            SerializerOptions);
    }

    private sealed record NormalizedIdentity(
        string? Platform,
        string? PlatformUserId,
        IReadOnlyDictionary<string, string[]>? ValidationErrors);

    private sealed record GroupAccessResult(
        BotApiError? Error,
        TrainingGroup? Group)
    {
        public static GroupAccessResult Allowed(TrainingGroup group) => new(null, group);

        public static GroupAccessResult Forbidden() => new(BotApiError.Forbidden, null);

        public static GroupAccessResult NotFound() => new(BotApiError.NotFound, null);
    }

    private sealed record LessonResolutionResult(
        BotApiError? Error,
        Guid GroupId,
        bool IsOccurrenceScopedAccess)
    {
        public static LessonResolutionResult Success(Guid groupId, bool isOccurrenceScopedAccess) => new(null, groupId, isOccurrenceScopedAccess);

        public static LessonResolutionResult Failure(BotApiError error) => new(error, Guid.Empty, false);
    }

    private sealed record MembershipWarningResult(bool HasWarning, string? Message);
}
