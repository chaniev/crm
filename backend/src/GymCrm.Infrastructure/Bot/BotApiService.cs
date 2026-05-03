using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Bot;
using GymCrm.Application.Clients;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Bot;

internal sealed class BotApiService(
    GymCrmDbContext dbContext,
    IAttendanceService attendanceService,
    IClientMembershipService membershipService,
    IAuditLogService auditLogService,
    BotIdempotencyService idempotencyService) : IBotApiService
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
        return BotApiResult<BotMenuResponse>.Success(new BotMenuResponse(
            MapUserContext(user, identity),
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

        var query = dbContext.TrainingGroups.AsNoTracking();
        if (user.Role == UserRole.Coach)
        {
            query = query.Where(group => group.Trainers.Any(trainer => trainer.TrainerId == user.Id));
        }

        var groups = await query
            .OrderBy(group => group.IsActive ? 0 : 1)
            .ThenBy(group => group.Name)
            .ThenBy(group => group.TrainingStartTime)
            .ThenBy(group => group.Id)
            .Select(group => new BotAttendanceGroup(
                group.Id,
                group.Name,
                group.TrainingStartTime.ToString("HH\\:mm"),
                group.ScheduleText,
                group.IsActive,
                group.Clients.Count(clientGroup => clientGroup.Client.Status == ClientStatus.Active)))
            .ToArrayAsync(cancellationToken);

        return BotApiResult<IReadOnlyList<BotAttendanceGroup>>.Success(groups);
    }

    public async Task<BotApiResult<BotAttendanceRoster>> GetAttendanceRosterAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotAttendanceRoster>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!IsAttendanceDateAllowed(user.Role, trainingDate))
        {
            return BotApiResult<BotAttendanceRoster>.Failure(BotApiError.InvalidAttendanceDate);
        }

        var groupAccess = await GetAccessibleGroupAsync(user, groupId, cancellationToken);
        if (groupAccess.Error.HasValue)
        {
            return BotApiResult<BotAttendanceRoster>.Failure(groupAccess.Error.Value);
        }

        var group = groupAccess.Group!;
        var clients = await dbContext.Clients
            .AsNoTracking()
            .Where(client =>
                client.Status == ClientStatus.Active &&
                client.Groups.Any(clientGroup => clientGroup.GroupId == groupId))
            .Include(client => client.Memberships)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(currentGroup => currentGroup.Trainers)
            .Include(client => client.AttendanceEntries)
            .AsSplitQuery()
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id)
            .ToArrayAsync(cancellationToken);

        return BotApiResult<BotAttendanceRoster>.Success(new BotAttendanceRoster(
            group.Id,
            group.Name,
            trainingDate,
            clients
                .Select(client => MapAttendanceClient(client, user, groupId, trainingDate))
                .ToArray()));
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
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (!IsAttendanceDateAllowed(user.Role, trainingDate))
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.InvalidAttendanceDate);
        }

        if (marks.Count == 0)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
            {
                ["attendanceMarks"] = ["Передайте хотя бы одну отметку посещаемости."]
            });
        }

        var groupAccess = await GetAccessibleGroupAsync(user, groupId, cancellationToken);
        if (groupAccess.Error.HasValue)
        {
            return BotApiResult<BotAttendanceSaveResponse>.Failure(groupAccess.Error.Value);
        }

        var group = groupAccess.Group!;
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
        var mutationResult = await attendanceService.SaveAsync(
            new SaveAttendanceCommand(
                groupId,
                trainingDate,
                user.Id,
                marks.Select(mark => new AttendanceMarkCommand(mark.ClientId, mark.IsPresent)).ToArray()),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            await idempotencyService.ReleaseAsync(recordId, cancellationToken);

            return mutationResult.Error switch
            {
                AttendanceBatchMutationError.GroupMissing => BotApiResult<BotAttendanceSaveResponse>.Failure(BotApiError.NotFound),
                AttendanceBatchMutationError.ClientOutsideGroup => BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
                {
                    ["attendanceMarks"] = ["Часть клиентов не принадлежит выбранной группе."]
                }),
                _ => BotApiResult<BotAttendanceSaveResponse>.Validation(new Dictionary<string, string[]>
                {
                    ["attendanceMarks"] = ["Не удалось сохранить посещаемость из-за некорректных данных."]
                })
            };
        }

        var details = mutationResult.Details!;
        var warningClients = await dbContext.Clients
            .AsNoTracking()
            .Where(client => marks.Select(mark => mark.ClientId).Contains(client.Id))
            .Include(client => client.Memberships)
            .ToArrayAsync(cancellationToken);

        var warnings = warningClients
            .Select(client =>
            {
                var currentMembership = GetCurrentMembership(client);
                var membershipWarning = EvaluateMembershipWarning(currentMembership, trainingDate);
                return new BotAttendanceClientWarning(
                    client.Id,
                    BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                    membershipWarning.Message,
                    currentMembership is not null && !currentMembership.IsPaid);
            })
            .Where(item => item.MembershipWarning is not null || item.HasUnpaidCurrentMembership)
            .OrderBy(item => item.FullName, StringComparer.CurrentCulture)
            .ThenBy(item => item.ClientId)
            .ToArray();

        var response = new BotAttendanceSaveResponse(
            group.Id,
            group.Name,
            trainingDate,
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
            $"Пользователь '{user.Login}' сохранил посещаемость через бота для группы '{group.Name}' за {trainingDate.ToString(DateFormat, CultureInfo.InvariantCulture)}.",
            null,
            JsonSerializer.Serialize(response, SerializerOptions),
            cancellationToken);

        await idempotencyService.CompleteAsync(recordId, response, cancellationToken);

        return BotApiResult<BotAttendanceSaveResponse>.Success(response);
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
                ["paging"] = [$"Параметры пагинации должны быть в диапазоне take 1..{MaxSearchTake} и skip >= 0."]
            });
        }

        var baseQuery = dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active);

        if (user.Role == UserRole.Coach)
        {
            baseQuery = ApplyCoachClientScope(baseQuery, user.Id);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var byName = ApplyFullNameSearch(baseQuery, query);
            if (user.Role is UserRole.HeadCoach or UserRole.Administrator)
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
            .Include(client => client.Memberships)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        return BotApiResult<BotClientSearchResponse>.Success(new BotClientSearchResponse(
            pageItems
                .Select(client => MapClientListItem(client, user, today))
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
            .Include(currentClient => currentClient.Memberships)
            .Include(currentClient => currentClient.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .AsSplitQuery()
            .SingleOrDefaultAsync(candidate => candidate.Id == clientId, cancellationToken);

        if (client is null)
        {
            return BotApiResult<BotClientCard>.Failure(BotApiError.NotFound);
        }

        var allowedGroupIds = user.Role == UserRole.Coach
            ? client.Groups
                .Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == user.Id))
                .Select(clientGroup => clientGroup.GroupId)
                .Distinct()
                .ToArray()
            : null;

        if (user.Role == UserRole.Coach && (allowedGroupIds is null || allowedGroupIds.Length == 0))
        {
            return BotApiResult<BotClientCard>.Failure(BotApiError.Forbidden);
        }

        var attendanceHistoryQuery = dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => attendance.ClientId == clientId);

        if (allowedGroupIds is { Length: > 0 })
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

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        return BotApiResult<BotClientCard>.Success(MapClientCard(client, user, today, attendanceHistory));
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
        if (user.Role is not (UserRole.HeadCoach or UserRole.Administrator))
        {
            return BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>.Failure(BotApiError.Forbidden);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var expiresBefore = today.AddDays(ClientMembershipQueryConstants.ExpiringMembershipWindowDays);

        var items = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active)
            .Select(client => new
            {
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                CurrentMembership = client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Select(membership => new
                    {
                        membership.MembershipType,
                        membership.ExpirationDate,
                        membership.IsPaid
                    })
                    .FirstOrDefault()
            })
            .Where(candidate =>
                candidate.CurrentMembership != null &&
                candidate.CurrentMembership.ExpirationDate.HasValue &&
                candidate.CurrentMembership.ExpirationDate.Value >= today &&
                candidate.CurrentMembership.ExpirationDate.Value < expiresBefore)
            .OrderBy(candidate => candidate.CurrentMembership!.ExpirationDate)
            .ThenBy(candidate => candidate.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.Id)
            .Select(candidate => new BotExpiringMembershipListItem(
                candidate.Id,
                BuildClientFullName(candidate.LastName, candidate.FirstName, candidate.MiddleName),
                candidate.CurrentMembership!.MembershipType.ToString(),
                candidate.CurrentMembership.ExpirationDate!.Value,
                candidate.CurrentMembership.ExpirationDate.Value.DayNumber - today.DayNumber,
                candidate.CurrentMembership.IsPaid))
            .ToArrayAsync(cancellationToken);

        return BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>.Success(items);
    }

    public async Task<BotApiResult<IReadOnlyList<BotUnpaidMembershipListItem>>> ListUnpaidMembershipsAsync(
        BotIdentity identity,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<IReadOnlyList<BotUnpaidMembershipListItem>>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (user.Role is not (UserRole.HeadCoach or UserRole.Administrator))
        {
            return BotApiResult<IReadOnlyList<BotUnpaidMembershipListItem>>.Failure(BotApiError.Forbidden);
        }

        var items = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active)
            .Select(client => new
            {
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                CurrentMembership = client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Select(membership => new
                    {
                        membership.MembershipType,
                        membership.PurchaseDate,
                        membership.ExpirationDate,
                        membership.IsPaid
                    })
                    .FirstOrDefault()
            })
            .Where(candidate => candidate.CurrentMembership != null && !candidate.CurrentMembership.IsPaid)
            .OrderBy(candidate => candidate.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.Id)
            .Select(candidate => new BotUnpaidMembershipListItem(
                candidate.Id,
                BuildClientFullName(candidate.LastName, candidate.FirstName, candidate.MiddleName),
                candidate.CurrentMembership!.MembershipType.ToString(),
                candidate.CurrentMembership.PurchaseDate,
                candidate.CurrentMembership.ExpirationDate,
                candidate.CurrentMembership.IsPaid))
            .ToArrayAsync(cancellationToken);

        return BotApiResult<IReadOnlyList<BotUnpaidMembershipListItem>>.Success(items);
    }

    public async Task<BotApiResult<BotMembershipPaymentResponse>> MarkMembershipPaymentAsync(
        BotIdentity identity,
        Guid clientId,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var resolvedUser = await ResolveUserAsync(identity, cancellationToken);
        if (!resolvedUser.Succeeded)
        {
            return BotApiResult<BotMembershipPaymentResponse>.Failure(resolvedUser.Error);
        }

        var user = resolvedUser.Value!;
        if (user.Role is not (UserRole.HeadCoach or UserRole.Administrator))
        {
            return BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.Forbidden);
        }

        var reservation = await idempotencyService.ReserveAsync<BotMembershipPaymentResponse>(
            identity,
            BotAuditConstants.BotMembershipPaymentMarkedAction,
            idempotencyKey,
            payloadJson,
            cancellationToken);

        if (reservation.State == BotIdempotencyService.ReservationState.Replay)
        {
            return BotApiResult<BotMembershipPaymentResponse>.Success(reservation.Response!);
        }

        if (reservation.State == BotIdempotencyService.ReservationState.Conflict)
        {
            return BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.IdempotencyConflict);
        }

        var recordId = reservation.RecordId!.Value;
        var clientBefore = await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Memberships)
            .SingleOrDefaultAsync(client => client.Id == clientId, cancellationToken);

        if (clientBefore is null)
        {
            await idempotencyService.ReleaseAsync(recordId, cancellationToken);
            return BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.NotFound);
        }

        var currentMembershipBefore = GetCurrentMembership(clientBefore);
        if (currentMembershipBefore is null)
        {
            await idempotencyService.ReleaseAsync(recordId, cancellationToken);
            return BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.CurrentMembershipMissing);
        }

        if (currentMembershipBefore.IsPaid)
        {
            var alreadyPaidResponse = new BotMembershipPaymentResponse(
                clientBefore.Id,
                BuildClientFullName(clientBefore.LastName, clientBefore.FirstName, clientBefore.MiddleName),
                currentMembershipBefore.MembershipType.ToString(),
                currentMembershipBefore.PurchaseDate,
                currentMembershipBefore.ExpirationDate,
                true,
                true);

            await idempotencyService.CompleteAsync(recordId, alreadyPaidResponse, cancellationToken);
            return BotApiResult<BotMembershipPaymentResponse>.Success(alreadyPaidResponse);
        }

        var mutationResult = await membershipService.MarkPaymentAsync(
            clientId,
            new MarkClientMembershipPaymentCommand(user.Id),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            await idempotencyService.ReleaseAsync(recordId, cancellationToken);
            return mutationResult.Error switch
            {
                ClientMembershipMutationError.ClientMissing => BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.NotFound),
                ClientMembershipMutationError.CurrentMembershipMissing => BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.CurrentMembershipMissing),
                _ => BotApiResult<BotMembershipPaymentResponse>.Failure(BotApiError.Validation)
            };
        }

        var clientAfter = await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Memberships)
            .SingleAsync(client => client.Id == clientId, cancellationToken);
        var currentMembershipAfter = GetCurrentMembership(clientAfter)
            ?? throw new InvalidOperationException($"Client '{clientId}' has no current membership after payment mark.");

        var response = new BotMembershipPaymentResponse(
            clientAfter.Id,
            BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName),
            currentMembershipAfter.MembershipType.ToString(),
            currentMembershipAfter.PurchaseDate,
            currentMembershipAfter.ExpirationDate,
            currentMembershipAfter.IsPaid,
            false);

        await WriteBotAuditAsync(
            user,
            identity,
            BotAuditConstants.BotMembershipPaymentMarkedAction,
            "ClientMembership",
            currentMembershipAfter.Id.ToString(),
            $"Пользователь '{user.Login}' отметил оплату абонемента через бота для клиента '{response.FullName}'.",
            SerializeMembershipAuditState(currentMembershipBefore),
            SerializeMembershipAuditState(currentMembershipAfter),
            cancellationToken);

        await idempotencyService.CompleteAsync(recordId, response, cancellationToken);
        return BotApiResult<BotMembershipPaymentResponse>.Success(response);
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
                ["actionCode"] = ["Укажите код запрещенного действия."]
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
            $"Пользователь '{user.Login}' получил отказ в доступе через бота при действии '{request.ActionCode.Trim()}'.",
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

        if (user.Role == UserRole.Coach)
        {
            var isAssigned = await dbContext.GroupTrainers
                .AsNoTracking()
                .AnyAsync(
                    trainer =>
                        trainer.GroupId == groupId &&
                        trainer.TrainerId == user.Id,
                    cancellationToken);

            if (!isAssigned)
            {
                return GroupAccessResult.Forbidden();
            }
        }

        return GroupAccessResult.Allowed(group);
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
            UserRole.HeadCoach or UserRole.Administrator =>
            [
                new BotMenuItem("attendance", "Посещения"),
                new BotMenuItem("client_search", "Поиск клиента"),
                new BotMenuItem("expiring_memberships", "Заканчивающиеся"),
                new BotMenuItem("unpaid_memberships", "Неоплаченные")
            ],
            UserRole.Coach =>
            [
                new BotMenuItem("attendance", "Посещения"),
                new BotMenuItem("client_search", "Поиск клиента")
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
            errors["platform"] = ["Bot API MVP поддерживает только Telegram identity."];
        }

        if (string.IsNullOrWhiteSpace(platformUserId))
        {
            errors["platformUserId"] = ["Укажите Telegram user id."];
        }

        return new NormalizedIdentity(
            string.IsNullOrWhiteSpace(platform) ? null : platform,
            string.IsNullOrWhiteSpace(platformUserId) ? null : platformUserId,
            errors.Count == 0 ? null : errors);
    }

    private static bool IsAttendanceDateAllowed(UserRole role, DateOnly trainingDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (trainingDate > today)
        {
            return false;
        }

        return role != UserRole.Coach || trainingDate >= today.AddDays(-2);
    }

    private IQueryable<Client> ApplyCoachClientScope(IQueryable<Client> query, Guid trainerId)
    {
        var assignedClientIds = dbContext.ClientGroups
            .Where(clientGroup => dbContext.GroupTrainers.Any(
                groupTrainer =>
                    groupTrainer.GroupId == clientGroup.GroupId &&
                    groupTrainer.TrainerId == trainerId))
            .Select(clientGroup => clientGroup.ClientId);

        return query.Where(client => assignedClientIds.Contains(client.Id));
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
        Guid groupId,
        DateOnly trainingDate)
    {
        var currentMembership = GetCurrentMembership(client);
        var visibleGroups = currentUser.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == currentUser.Id))
            : client.Groups.AsEnumerable();
        var warning = EvaluateMembershipWarning(currentMembership, trainingDate);
        var isPresent = client.AttendanceEntries.Any(attendance =>
            attendance.GroupId == groupId &&
            attendance.TrainingDate == trainingDate &&
            attendance.IsPresent);

        return new BotAttendanceClient(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            MapGroups(visibleGroups),
            MapPhoto(client),
            isPresent,
            warning.HasWarning,
            warning.Message,
            currentMembership is not null && !currentMembership.IsPaid,
            HasActivePaidMembership(currentMembership, trainingDate));
    }

    private static BotClientListItem MapClientListItem(
        Client client,
        User user,
        DateOnly trainingDate)
    {
        var currentMembership = GetCurrentMembership(client);
        var warning = EvaluateMembershipWarning(currentMembership, trainingDate);
        var groups = user.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == user.Id))
            : client.Groups.AsEnumerable();

        return new BotClientListItem(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            user.Role == UserRole.Coach ? null : client.Phone,
            client.Status.ToString(),
            MapGroups(groups),
            MapPhoto(client),
            warning.HasWarning,
            warning.Message,
            currentMembership is not null && !currentMembership.IsPaid,
            HasActivePaidMembership(currentMembership, trainingDate));
    }

    private static BotClientCard MapClientCard(
        Client client,
        User user,
        DateOnly trainingDate,
        IReadOnlyList<BotAttendanceHistoryItem> attendanceHistory)
    {
        var currentMembership = GetCurrentMembership(client);
        var warning = EvaluateMembershipWarning(currentMembership, trainingDate);
        var groups = user.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == user.Id))
            : client.Groups.AsEnumerable();

        return new BotClientCard(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            user.Role == UserRole.Coach ? null : client.Phone,
            client.Status.ToString(),
            MapGroups(groups),
            MapPhoto(client),
            warning.HasWarning,
            warning.Message,
            currentMembership is not null && !currentMembership.IsPaid,
            HasActivePaidMembership(currentMembership, trainingDate),
            user.Role == UserRole.Coach || currentMembership is null
                ? null
                : new BotClientMembership(
                    currentMembership.Id,
                    currentMembership.MembershipType.ToString(),
                    currentMembership.PurchaseDate,
                    currentMembership.ExpirationDate,
                    currentMembership.PaymentAmount,
                    currentMembership.IsPaid,
                    currentMembership.SingleVisitUsed),
            attendanceHistory);
    }

    private static IReadOnlyList<BotClientGroupSummary> MapGroups(IEnumerable<ClientGroup> groups)
    {
        return groups
            .Select(clientGroup => new BotClientGroupSummary(
                clientGroup.GroupId,
                clientGroup.Group.Name,
                clientGroup.Group.IsActive,
                clientGroup.Group.TrainingStartTime.ToString("HH\\:mm"),
                clientGroup.Group.ScheduleText))
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
        ClientMembership? membership,
        DateOnly trainingDate)
    {
        if (membership is null)
        {
            return new MembershipWarningResult(true, "У клиента нет текущего абонемента.");
        }

        var messages = new List<string>();
        if (membership.PurchaseDate > trainingDate)
        {
            messages.Add("абонемент куплен позже выбранной даты");
        }

        if (!membership.IsPaid)
        {
            messages.Add("абонемент не оплачен");
        }

        if (membership.MembershipType == MembershipType.SingleVisit && membership.SingleVisitUsed)
        {
            messages.Add("разовое посещение уже списано");
        }

        if (membership.ExpirationDate.HasValue && membership.ExpirationDate.Value < trainingDate)
        {
            messages.Add("абонемент истек");
        }

        return messages.Count == 0
            ? new MembershipWarningResult(false, null)
            : new MembershipWarningResult(true, $"Проверьте абонемент: {string.Join(", ", messages)}.");
    }

    private static bool HasActivePaidMembership(
        ClientMembership? membership,
        DateOnly trainingDate)
    {
        if (membership is null || !membership.IsPaid || membership.PurchaseDate > trainingDate)
        {
            return false;
        }

        if (membership.ExpirationDate.HasValue && membership.ExpirationDate.Value < trainingDate)
        {
            return false;
        }

        return membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed;
    }

    private static ClientMembership? GetCurrentMembership(Client client)
    {
        return client.Memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .FirstOrDefault(membership => membership.ValidTo is null);
    }

    private static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? "Клиент без имени"
            : fullName;
    }

    private static string SerializeMembershipAuditState(ClientMembership membership)
    {
        return JsonSerializer.Serialize(
            new
            {
                membership.Id,
                membership.ClientId,
                MembershipType = membership.MembershipType.ToString(),
                membership.PurchaseDate,
                membership.ExpirationDate,
                membership.PaymentAmount,
                membership.IsPaid,
                membership.SingleVisitUsed,
                membership.PaidByUserId,
                membership.PaidAt,
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

    private sealed record MembershipWarningResult(bool HasWarning, string? Message);
}
