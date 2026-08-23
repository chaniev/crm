using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Api.Auth;

internal static class GroupEndpoints
{
    private const int MaxGroupDeactivationAffectedMemberships = 5;
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapGroupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(GroupApiConstants.RoutePrefix)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageGroups);

        group.MapGet(GroupApiConstants.ListRoute, ListGroupsAsync);
        group.MapGet(GroupApiConstants.SummaryRoute, GetGroupSummaryAsync);
        group.MapGet(GroupApiConstants.TrainerOptionsRoute, ListTrainerOptionsAsync);
        group.MapGet(GroupApiConstants.LegacyTrainerOptionsRoute, ListTrainerOptionsAsync);
        group.MapGet(GroupApiConstants.DetailsRoute, GetGroupAsync);
        group.MapGet(GroupApiConstants.ClientsRoute, GetGroupClientsAsync);
        group.MapPost(GroupApiConstants.PreviewRoute, PreviewGroupAsync);
        group.MapPost(GroupApiConstants.ListRoute, CreateGroupAsync);
        group.MapPut(GroupApiConstants.DetailsRoute, UpdateGroupAsync);
        GroupTrainerAssignmentEndpoints.Map(group);
        GroupLessonSeriesEndpoints.Map(group);

        return endpoints;
    }

    private static async Task<Results<Ok<GroupListResponse>, ValidationProblem, UnauthorizedHttpResult>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        string? query,
        bool? isActive,
        bool? withoutTrainer,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var errors = GroupRequestValidator.ValidatePaging(page, pageSize, skip, take);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = GroupRequestValidator.ResolvePaging(page, pageSize, skip, take);
        var groupsQuery = GroupManagementScope.ApplyTo(TrainingGroupListQuery.CreateBaseQuery(dbContext), currentUser);
        groupsQuery = ApplyListCriteria(groupsQuery, query, isActive, withoutTrainer);
        var totalCount = await groupsQuery.CountAsync(cancellationToken);
        var groups = await TrainingGroupListQuery.LoadPageAsync(groupsQuery, paging, cancellationToken);

        IReadOnlyList<GroupListItemResponse> response = groups
            .Select(TrainingGroupListItemMapper.Map)
            .ToArray();

        return TypedResults.Ok(new GroupListResponse(response, totalCount, paging.Skip, paging.Take));
    }

    private static async Task<Results<Ok<GroupSummaryResponse>, UnauthorizedHttpResult>> GetGroupSummaryAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var query = GroupManagementScope.ApplyTo(dbContext.TrainingGroups.AsNoTracking(), currentUser);
        var totalCount = await query.CountAsync(cancellationToken);
        var activeWithoutTrainerCount = await query
            .CountAsync(trainingGroup => trainingGroup.IsActive && !trainingGroup.Trainers.Any(), cancellationToken);

        return TypedResults.Ok(new GroupSummaryResponse(totalCount, activeWithoutTrainerCount));
    }

    private static async Task<Ok<IReadOnlyList<TrainerOptionResponse>>> ListTrainerOptionsAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<TrainerOptionResponse> trainers = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.IsActive && GroupTrainerEligibility.AssignableRoles.Contains(user.Role))
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => new TrainerOptionResponse(
                user.Id,
                user.FullName,
                user.Login))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(trainers);
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetGroupAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await LoadGroupSnapshotAsync(id, dbContext, cancellationToken);
        if (group is not null && !GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        return group is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapDetails(group));
    }

    private static async Task<Results<Ok<IReadOnlyList<GroupClientResponse>>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetGroupClientsAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var groupBranchId = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => group.Id == id)
            .Select(group => (Guid?)group.BranchId)
            .SingleOrDefaultAsync(cancellationToken);

        if (!groupBranchId.HasValue)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, groupBranchId.Value))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var clients = await dbContext.ClientGroups
            .AsNoTracking()
            .Where(clientGroup => clientGroup.GroupId == id)
            .Select(clientGroup => new GroupClientProjection(
                clientGroup.Client.Id,
                clientGroup.Client.LastName,
                clientGroup.Client.FirstName,
                clientGroup.Client.MiddleName,
                clientGroup.Client.Status.ToString()))
            .ToListAsync(cancellationToken);

        IReadOnlyList<GroupClientResponse> response = clients
            .OrderBy(client => client.LastName, StringComparer.CurrentCulture)
            .ThenBy(client => client.FirstName, StringComparer.CurrentCulture)
            .ThenBy(client => client.MiddleName, StringComparer.CurrentCulture)
            .ThenBy(client => client.Id)
            .Select(client => new GroupClientResponse(
                client.Id,
                BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                client.Status))
            .ToArray();

        return TypedResults.Ok(response);
    }

    private static async Task<IResult> PreviewGroupAsync(
        UpsertTrainingGroupRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var parsed = await ValidateGroupCreateWithInitialSeriesAsync(request, currentUser, dbContext, cancellationToken);
        if (parsed.Forbidden)
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var payload = CreateGroupCreatePayload(parsed);
        var payloadJson = ScheduleMutationTokenPolicy.SerializePayload(payload);
        var payloadHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(payloadJson);
        var rawToken = ScheduleMutationTokenPolicy.CreateSecureToken();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(ScheduleMutationTokenPolicy.ConfirmationTokenLifetime);
        dbContext.ScheduleMutationConfirmationTokens.Add(new ScheduleMutationConfirmationToken
        {
            Id = Guid.NewGuid(),
            TokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken),
            ActorUserId = currentUser.Id,
            Purpose = ScheduleMutationTokenPolicy.GroupCreatePurpose,
            PayloadHash = payloadHash,
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new GroupPreviewResponse(rawToken, expiresAt, []));
    }

    private static async Task<Results<Created<GroupDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateGroupAsync(
        UpsertTrainingGroupRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        return await CreateGroupWithInitialSeriesAsync(
            request,
            currentUser,
            dbContext,
            auditLogService,
            cancellationToken);
    }

    private static async Task<Results<Created<GroupDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateGroupWithInitialSeriesAsync(
        UpsertTrainingGroupRequest request,
        GymCrm.Domain.Users.User currentUser,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ConfirmationToken))
        {
            return CreateGroupPreviewTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var rawToken = request.ConfirmationToken.Trim();
        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken);
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == currentUser.Id &&
                candidate.Purpose == ScheduleMutationTokenPolicy.GroupCreatePurpose,
                cancellationToken);
        if (token is null || token.ConsumedAt is not null)
        {
            return CreateGroupPreviewTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ExpiresAt <= now)
        {
            return CreateGroupPreviewTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var parsed = await ValidateGroupCreateWithInitialSeriesAsync(request, currentUser, dbContext, cancellationToken);
        if (parsed.Forbidden)
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        if (!ScheduleMutationTokenPolicy.PayloadMatches(token.PayloadHash, CreateGroupCreatePayload(parsed)))
        {
            return CreateGroupPreviewTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = parsed.NormalizedRequest.BranchId!.Value,
            HallId = parsed.FirstSlot.HallId!.Value,
            GroupTypeId = parsed.NormalizedRequest.GroupTypeId!.Value,
            Name = parsed.NormalizedRequest.Name,
            TrainingStartTime = GroupRequestValidator.ParseTrainingStartTime(parsed.FirstSlot.StartTime)!.Value,
            DurationMinutes = parsed.FirstSlot.DurationMinutes!.Value,
            Weekdays = parsed.Slots.Select(slot => slot.IsoWeekday!.Value).Distinct().Order().ToArray(),
            IsActive = parsed.NormalizedRequest.IsActive ?? true,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var trainerId in parsed.NormalizedRequest.TrainerIds)
        {
            group.Trainers.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = trainerId
            });
            group.TrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                TrainerId = trainerId,
                ValidFrom = parsed.StartsOn!.Value,
                CreatedByUserId = currentUser.Id,
                CreatedAt = now
            });
        }

        var series = new LessonSeries
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            StartsOn = parsed.StartsOn!.Value,
            EndsOn = parsed.EndsOn,
            CreatedAt = now,
            UpdatedAt = now
        };
        var rule = new LessonScheduleRuleVersion
        {
            Id = Guid.NewGuid(),
            LessonSeriesId = series.Id,
            VersionNumber = 1,
            EffectiveFrom = parsed.StartsOn.Value,
            EffectiveTo = parsed.EndsOn,
            CreatedAt = now
        };
        foreach (var slot in parsed.Slots)
        {
            rule.Slots.Add(new LessonScheduleSlot
            {
                Id = Guid.NewGuid(),
                LessonScheduleRuleVersionId = rule.Id,
                SlotLineageId = Guid.NewGuid(),
                IsoWeekday = slot.IsoWeekday!.Value,
                StartTime = GroupRequestValidator.ParseTrainingStartTime(slot.StartTime)!.Value,
                DurationMinutes = slot.DurationMinutes!.Value,
                HallId = slot.HallId!.Value,
                CreatedAt = now
            });
        }

        var mutationTransaction = await BeginGroupMutationTransactionAsync(dbContext, cancellationToken);
        TrainingGroup createdGroup;
        try
        {
            var tokenClaim = await ScheduleMutationTokenClaimPolicy.ClaimAsync(
                dbContext,
                token,
                now,
                cancellationToken);
            if (tokenClaim == ScheduleMutationTokenClaimResult.Invalid)
            {
                return CreateGroupPreviewTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
            }

            if (tokenClaim == ScheduleMutationTokenClaimResult.Expired)
            {
                return CreateGroupPreviewTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
            }

            dbContext.TrainingGroups.Add(group);
            dbContext.LessonSeries.Add(series);
            dbContext.LessonScheduleRuleVersions.Add(rule);
            await dbContext.SaveChangesAsync(cancellationToken);

            createdGroup = await LoadGroupSnapshotAsync(group.Id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Created training group '{group.Id}' was not found.");

            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.TrainingGroupCreatedAction,
                    GroupAuditConstants.TrainingGroupEntityType,
                    group.Id.ToString(),
                    GroupResources.TrainingGroupCreatedDescription(currentUser.Login, group.Name),
                    NewValueJson: SerializeAuditState(createdGroup)),
                cancellationToken);

            if (mutationTransaction is not null)
            {
                await mutationTransaction.CommitAsync(cancellationToken);
            }
        }
        finally
        {
            if (mutationTransaction is not null)
            {
                await mutationTransaction.DisposeAsync();
            }
        }

        return TypedResults.Created($"{GroupApiConstants.RoutePrefix}/{group.Id}", MapDetails(createdGroup));
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupAsync(
        Guid id,
        UpdateTrainingGroupIdentityRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var normalizedRequest = GroupRequestValidator.NormalizeRequest(new UpsertTrainingGroupRequest(
            request.Name,
            request.BranchId,
            group.HallId,
            request.GroupTypeId,
            group.TrainingStartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            group.DurationMinutes,
            group.Weekdays,
            request.IsActive,
            group.Trainers.Select(assignment => assignment.TrainerId).ToArray()));
        var validationErrors = await GroupRequestValidator.ValidateUpsertRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken,
            group.Id);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        if (!GroupManagementScope.Contains(currentUser, normalizedRequest.BranchId!.Value))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var requestedIsActive = normalizedRequest.IsActive ?? group.IsActive;
        var deactivatingGroup = group.IsActive && !requestedIsActive;
        var oldState = SerializeAuditState(group);
        var mutationTransaction = await BeginGroupMutationTransactionAsync(dbContext, cancellationToken);
        try
        {
            if (deactivatingGroup)
            {
                await LockGroupDeactivationRowsAsync(group.Id, dbContext, cancellationToken);
                var blockingMemberships = await LoadGroupDeactivationBlockersAsync(
                    group.Id,
                    businessDateProvider.Today,
                    dbContext,
                    cancellationToken);
                if (blockingMemberships.Count > 0)
                {
                    return CreateGroupActiveMembershipsProblem(blockingMemberships);
                }
            }

            group.Name = normalizedRequest.Name;
            group.BranchId = normalizedRequest.BranchId!.Value;
            group.GroupTypeId = normalizedRequest.GroupTypeId!.Value;
            group.IsActive = requestedIsActive;
            group.UpdatedAt = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(cancellationToken);
            if (mutationTransaction is not null)
            {
                await mutationTransaction.CommitAsync(cancellationToken);
            }
        }
        finally
        {
            if (mutationTransaction is not null)
            {
                await mutationTransaction.DisposeAsync();
            }
        }

        var updatedGroup = await LoadGroupSnapshotAsync(group.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated training group '{group.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupAuditConstants.TrainingGroupUpdatedAction,
                GroupAuditConstants.TrainingGroupEntityType,
                group.Id.ToString(),
                GroupResources.TrainingGroupUpdatedDescription(currentUser.Login, group.Name),
                oldState,
                SerializeAuditState(updatedGroup)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedGroup));
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupTrainersAsync(
        Guid id,
        UpdateGroupTrainersRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var normalizedTrainerIds = GroupRequestValidator.NormalizeTrainerIds(request.TrainerIds);
        var validationErrors = await GroupRequestValidator.ValidateTrainerIdsAsync(request.TrainerIds, normalizedTrainerIds, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeAuditState(group);

        var now = DateTimeOffset.UtcNow;
        ApplyTrainerAssignments(group, normalizedTrainerIds, currentUser.Id, now, dbContext);
        group.UpdatedAt = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedGroup = await LoadGroupSnapshotAsync(group.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated training group '{group.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupAuditConstants.TrainingGroupUpdatedAction,
                GroupAuditConstants.TrainingGroupEntityType,
                group.Id.ToString(),
                GroupResources.TrainingGroupTrainersUpdatedDescription(currentUser.Login, group.Name),
                oldState,
                SerializeAuditState(updatedGroup)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedGroup));
    }

    private static async Task<TrainingGroup?> LoadGroupSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .AsNoTracking()
            .Include(group => group.Branch)
            .Include(group => group.Hall)
            .Include(group => group.GroupType)
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static async Task<TrainingGroup?> LoadGroupForMutationAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .Include(group => group.Branch)
            .Include(group => group.Hall)
            .Include(group => group.GroupType)
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static IQueryable<TrainingGroup> ApplyListCriteria(
        IQueryable<TrainingGroup> query,
        string? searchQuery,
        bool? isActive,
        bool? withoutTrainer)
    {
        var normalizedQuery = searchQuery?.Trim();
        if (!string.IsNullOrEmpty(normalizedQuery))
        {
            var loweredQuery = normalizedQuery.ToLower();
            query = query.Where(group => group.Name.ToLower().Contains(loweredQuery));
        }

        if (isActive.HasValue)
        {
            query = query.Where(group => group.IsActive == isActive.Value);
        }

        if (withoutTrainer == true)
        {
            query = query.Where(group => !group.Trainers.Any());
        }

        return query;
    }

    private static async Task<IDbContextTransaction?> BeginGroupMutationTransactionAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private static async Task LockGroupDeactivationRowsAsync(
        Guid groupId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMembershipTargetGroups" WHERE "GroupId" = {groupId} ORDER BY "ClientMembershipId", "Position" FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMemberships" WHERE "ValidTo" IS NULL AND "Id" IN (SELECT "ClientMembershipId" FROM "ClientMembershipTargetGroups" WHERE "GroupId" = {groupId}) ORDER BY "ClientId", "Id" FOR UPDATE""",
            cancellationToken);
    }

    private static async Task<IReadOnlyList<GroupDeactivationBlockingMembership>> LoadGroupDeactivationBlockersAsync(
        Guid groupId,
        DateOnly businessDate,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var candidates = await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Client)
            .Include(membership => membership.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .Where(membership =>
                membership.ValidTo == null &&
                membership.TargetGroups.Any(target => target.GroupId == groupId))
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);

        return candidates
            .Select(membership => new
            {
                Membership = membership,
                State = ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate)
            })
            .Where(row => row.State is ClientMembershipEntitlementState.Active or ClientMembershipEntitlementState.Future)
            .OrderBy(row => row.Membership.Client.LastName)
            .ThenBy(row => row.Membership.Client.FirstName)
            .ThenBy(row => row.Membership.Client.MiddleName)
            .ThenBy(row => row.Membership.ClientId)
            .ThenBy(row => row.Membership.Id)
            .Take(MaxGroupDeactivationAffectedMemberships)
            .Select(row => new GroupDeactivationBlockingMembership(
                row.Membership.Id,
                row.Membership.SaleId,
                row.Membership.ClientId,
                BuildClientFullName(
                    row.Membership.Client.LastName,
                    row.Membership.Client.FirstName,
                    row.Membership.Client.MiddleName),
                row.Membership.BehaviorKind.ToString(),
                row.State.ToString(),
                row.Membership.TargetGroups
                    .OrderBy(target => target.Position)
                    .Select(target => new GroupDeactivationTargetSummary(
                        target.GroupId,
                        target.Group.Name,
                        target.BranchId,
                        target.Group.Branch.Name,
                        target.Position))
                    .ToArray()))
            .ToArray();
    }

    private static ProblemHttpResult CreateGroupActiveMembershipsProblem(
        IReadOnlyList<GroupDeactivationBlockingMembership> blockingMemberships)
    {
        return TypedResults.Problem(new HttpValidationProblemDetails(new Dictionary<string, string[]>
        {
            ["isActive"] = ["Нельзя отключить группу, пока в ней есть действующие или будущие абонементы."]
        })
        {
            Status = StatusCodes.Status409Conflict,
            Type = "group-active-memberships",
            Title = "Группа используется в абонементах",
            Detail = "Сначала перенесите или исправьте адресность действующих и будущих абонементов этой группы.",
            Extensions =
            {
                ["code"] = "group-active-memberships",
                ["recovery"] = "Откройте карточки клиентов из списка и перенесите абонементы на другую группу либо дождитесь окончания срока действия.",
                ["affectedMemberships"] = blockingMemberships
            }
        });
    }

    private static void ApplyTrainerAssignments(
        TrainingGroup group,
        IReadOnlyList<Guid> requestedTrainerIds,
        Guid changedByUserId,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        var requested = requestedTrainerIds.ToHashSet();
        var today = DateOnly.FromDateTime(now.UtcDateTime.Date);

        var trainersToRemove = group.Trainers
            .Where(groupTrainer => !requested.Contains(groupTrainer.TrainerId))
            .ToArray();
        var assignmentsToClose = group.TrainerAssignments
            .Where(assignment => assignment.ValidTo == null && !requested.Contains(assignment.TrainerId))
            .ToArray();

        dbContext.GroupTrainers.RemoveRange(trainersToRemove);

        foreach (var trainerToRemove in trainersToRemove)
        {
            group.Trainers.Remove(trainerToRemove);
        }

        foreach (var assignment in assignmentsToClose)
        {
            CloseOrRemoveTrainerAssignment(assignment, today, dbContext.GroupTrainerAssignments);
        }

        var existingTrainerIds = group.Trainers
            .Select(groupTrainer => groupTrainer.TrainerId)
            .ToHashSet();
        var activeAssignmentTrainerIds = group.TrainerAssignments
            .Where(assignment => assignment.ValidTo == null && requested.Contains(assignment.TrainerId))
            .Select(assignment => assignment.TrainerId)
            .ToHashSet();

        foreach (var trainerId in requested.Where(trainerId => !existingTrainerIds.Contains(trainerId)))
        {
            group.Trainers.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = trainerId
            });
        }

        foreach (var trainerId in requested.Where(trainerId => !activeAssignmentTrainerIds.Contains(trainerId)))
        {
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                TrainerId = trainerId,
                ValidFrom = today,
                CreatedByUserId = changedByUserId,
                CreatedAt = now
            });
        }
    }

    private static void CloseOrRemoveTrainerAssignment(
        GroupTrainerAssignment assignment,
        DateOnly validTo,
        DbSet<GroupTrainerAssignment> assignments)
    {
        if (assignment.ValidFrom >= validTo)
        {
            assignments.Remove(assignment);
            return;
        }

        assignment.ValidTo = validTo;
    }

    private static GroupDetailsResponse MapDetails(TrainingGroup group)
    {
        var trainers = group.Trainers
            .Select(groupTrainer => groupTrainer.Trainer)
            .OrderBy(trainer => trainer.FullName, StringComparer.CurrentCulture)
            .ThenBy(trainer => trainer.Login, StringComparer.CurrentCulture)
            .Select(trainer => new TrainerSummaryResponse(
                trainer.Id,
                trainer.FullName,
                trainer.Login))
            .ToArray();

        return new GroupDetailsResponse(
            group.Id,
            group.Name,
            group.BranchId,
            group.Branch.Name,
            group.HallId,
            group.Hall.Name,
            group.GroupTypeId,
            group.GroupType.Name,
            FormatTrainingStartTime(group.TrainingStartTime),
            group.DurationMinutes,
            SortWeekdays(group.Weekdays),
            group.IsActive,
            trainers.Select(trainer => trainer.Id).ToArray(),
            trainers,
            group.Clients.Count,
            group.UpdatedAt,
            BuildTrainerAssignmentRevision(group.TrainerAssignments),
            group.TrainerAssignments
                .OrderBy(assignment => assignment.ValidFrom)
                .ThenBy(assignment => assignment.ValidTo)
                .ThenBy(assignment => assignment.Trainer.FullName, StringComparer.CurrentCulture)
                .ThenBy(assignment => assignment.TrainerId)
                .Select(assignment => new GroupTrainerAssignmentPeriodResponse(
                    assignment.TrainerId,
                    assignment.Trainer.FullName,
                    assignment.ValidFrom,
                    assignment.ValidTo))
                .ToArray());
    }

    private static string BuildTrainerAssignmentRevision(IEnumerable<GroupTrainerAssignment> assignments)
    {
        var canonical = string.Join(
            "|",
            assignments
                .OrderBy(assignment => assignment.ValidFrom)
                .ThenBy(assignment => assignment.ValidTo)
                .ThenBy(assignment => assignment.TrainerId)
                .Select(assignment => string.Join(
                    ",",
                    assignment.TrainerId.ToString("D"),
                    assignment.ValidFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    assignment.ValidTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty)));

        return ScheduleMutationTokenPolicy.ComputeSha256Base64Url(canonical);
    }

    private static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? ClientResources.ClientWithoutName
            : fullName;
    }

    private static string FormatTrainingStartTime(TimeOnly trainingStartTime)
    {
        return trainingStartTime.ToString("HH':'mm", CultureInfo.InvariantCulture);
    }

    private static string SerializeAuditState(TrainingGroup group)
    {
        return JsonSerializer.Serialize(
            new TrainingGroupAuditState(
                group.Id,
                group.Name,
                group.BranchId,
                group.HallId,
                group.GroupTypeId,
                FormatTrainingStartTime(group.TrainingStartTime),
                group.DurationMinutes,
                SortWeekdays(group.Weekdays),
                group.IsActive,
                group.Trainers
                    .Select(groupTrainer => groupTrainer.TrainerId)
                    .OrderBy(trainerId => trainerId)
                    .ToArray(),
                group.Clients.Count,
                group.UpdatedAt),
            AuditSerializerOptions);
    }

    private static int[] SortWeekdays(IEnumerable<int> weekdays)
    {
        return weekdays
            .OrderBy(weekday => weekday)
            .ToArray();
    }

    private static async Task<InitialSeriesValidation> ValidateGroupCreateWithInitialSeriesAsync(
        UpsertTrainingGroupRequest request,
        GymCrm.Domain.Users.User currentUser,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var series = request.InitialLessonSeries;
        if (series?.Slots is null || series.Slots.Count == 0)
        {
            errors["initialLessonSeries.slots"] = ["Initial lesson series must include at least one slot."];
        }

        var startsOn = ParseGroupSeriesDate(series?.StartsOn);
        if (!startsOn.HasValue)
        {
            errors["initialLessonSeries.startsOn"] = ["startsOn должен быть в формате yyyy-MM-dd."];
        }

        DateOnly? endsOn = null;
        if (!string.IsNullOrWhiteSpace(series?.EndsOn))
        {
            endsOn = ParseGroupSeriesDate(series.EndsOn);
            if (!endsOn.HasValue)
            {
                errors["initialLessonSeries.endsOn"] = ["endsOn должен быть в формате yyyy-MM-dd."];
            }
        }

        if (startsOn.HasValue && endsOn.HasValue && endsOn.Value < startsOn.Value)
        {
            errors["initialLessonSeries.endsOn"] = ["endsOn должен быть не раньше startsOn."];
        }

        var slots = series?.Slots?.ToArray() ?? [];
        for (var index = 0; index < slots.Length; index++)
        {
            var slot = slots[index];
            var prefix = $"initialLessonSeries.slots[{index}]";
            if (slot.IsoWeekday is null or < 1 or > 7)
            {
                errors[$"{prefix}.isoWeekday"] = ["isoWeekday должен быть от 1 до 7."];
            }

            if (GroupRequestValidator.ParseTrainingStartTime(slot.StartTime) is null)
            {
                errors[$"{prefix}.startTime"] = ["startTime должен быть в формате HH:mm."];
            }

            if (slot.DurationMinutes is null or < GroupApiConstants.MinDurationMinutes or > GroupApiConstants.MaxDurationMinutes)
            {
                errors[$"{prefix}.durationMinutes"] = [GroupResources.DurationMinutesOutOfRange(GroupApiConstants.MinDurationMinutes, GroupApiConstants.MaxDurationMinutes)];
            }

            if (!slot.HallId.HasValue || slot.HallId.Value == Guid.Empty)
            {
                errors[$"{prefix}.hallId"] = [GroupResources.InvalidHallId];
            }
        }

        var firstSlot = slots.FirstOrDefault();
        var normalizedRequest = GroupRequestValidator.NormalizeRequest(request with
        {
            HallId = firstSlot?.HallId,
            TrainingStartTime = firstSlot?.StartTime ?? string.Empty,
            DurationMinutes = firstSlot?.DurationMinutes,
            Weekdays = slots
                .Where(slot => slot.IsoWeekday.HasValue)
                .Select(slot => slot.IsoWeekday!.Value)
                .Distinct()
                .ToArray()
        });
        foreach (var pair in await GroupRequestValidator.ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken))
        {
            errors.TryAdd(pair.Key, pair.Value);
        }

        if (normalizedRequest.BranchId.HasValue && !GroupManagementScope.Contains(currentUser, normalizedRequest.BranchId.Value))
        {
            return new InitialSeriesValidation(errors, normalizedRequest, firstSlot ?? new InitialLessonSeriesSlotRequest(null, null, null, null), startsOn, endsOn, slots)
            {
                Forbidden = true
            };
        }

        if (errors.Count == 0)
        {
            var hallIds = slots.Select(slot => slot.HallId!.Value).Distinct().ToArray();
            var hallBranchIds = await dbContext.Halls
                .AsNoTracking()
                .Where(hall => hallIds.Contains(hall.Id))
                .Select(hall => new { hall.Id, hall.BranchId })
                .ToArrayAsync(cancellationToken);
            foreach (var missingHallId in hallIds.Except(hallBranchIds.Select(hall => hall.Id)))
            {
                errors[$"initialLessonSeries.slots.hallId.{missingHallId:D}"] = ["Зал не найден."];
            }

            if (hallBranchIds.Any(hall => hall.BranchId != normalizedRequest.BranchId!.Value))
            {
                errors["initialLessonSeries.slots.hallId"] = ["Все залы расписания должны принадлежать филиалу группы."];
            }

            foreach (var group in slots
                         .GroupBy(slot => slot.IsoWeekday!.Value)
                         .Where(group => group.SelectMany((left, leftIndex) => group.Skip(leftIndex + 1).Select(right => (left, right))).Any(pair =>
                             ScheduleTimeRangePolicy.Overlaps(
                                 GroupRequestValidator.ParseTrainingStartTime(pair.left.StartTime)!.Value,
                                 pair.left.DurationMinutes!.Value,
                                 GroupRequestValidator.ParseTrainingStartTime(pair.right.StartTime)!.Value,
                                 pair.right.DurationMinutes!.Value))))
            {
                errors["initialLessonSeries.slots"] = [$"Slots for ISO weekday {group.Key} overlap."];
            }
        }

        return new InitialSeriesValidation(
            errors,
            normalizedRequest,
            firstSlot ?? new InitialLessonSeriesSlotRequest(null, null, null, null),
            startsOn,
            endsOn,
            slots);
    }

    private static DateOnly? ParseGroupSeriesDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
    }

    private static GroupCreateConfirmationPayload CreateGroupCreatePayload(InitialSeriesValidation parsed)
    {
        return new GroupCreateConfirmationPayload(
            parsed.NormalizedRequest.Name,
            parsed.NormalizedRequest.BranchId!.Value,
            parsed.NormalizedRequest.GroupTypeId!.Value,
            parsed.NormalizedRequest.IsActive ?? true,
            parsed.NormalizedRequest.TrainerIds,
            parsed.StartsOn!.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            parsed.EndsOn?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            parsed.Slots
                .OrderBy(slot => slot.IsoWeekday!.Value)
                .ThenBy(slot => GroupRequestValidator.ParseTrainingStartTime(slot.StartTime)!.Value)
                .ThenBy(slot => slot.HallId!.Value)
                .Select(slot => new GroupCreateSlotConfirmationPayload(
                    slot.IsoWeekday!.Value,
                    GroupRequestValidator.ParseTrainingStartTime(slot.StartTime)!.Value.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                    slot.DurationMinutes!.Value,
                    slot.HallId!.Value))
                .ToArray());
    }

    private static ProblemHttpResult CreateGroupPreviewTokenProblem(string code, int statusCode)
    {
        return TypedResults.Problem(new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = $"/problems/{code}",
            Title = "Group preview token is not valid for this mutation.",
            Status = statusCode,
            Extensions =
            {
                ["code"] = code
            }
        });
    }

    private sealed record InitialSeriesValidation(
        Dictionary<string, string[]> Errors,
        NormalizedGroupRequest NormalizedRequest,
        InitialLessonSeriesSlotRequest FirstSlot,
        DateOnly? StartsOn,
        DateOnly? EndsOn,
        IReadOnlyList<InitialLessonSeriesSlotRequest> Slots)
    {
        public bool Forbidden { get; init; }
    }

    private sealed record GroupDeactivationBlockingMembership(
        Guid MembershipId,
        Guid SaleId,
        Guid ClientId,
        string ClientName,
        string MembershipType,
        string EntitlementState,
        IReadOnlyList<GroupDeactivationTargetSummary> TargetGroups);

    private sealed record GroupDeactivationTargetSummary(
        Guid GroupId,
        string GroupName,
        Guid BranchId,
        string BranchName,
        int Position);
}
