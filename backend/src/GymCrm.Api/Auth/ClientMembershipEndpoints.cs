using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using static GymCrm.Api.Auth.ClientEndpointSharedHelpers;
using static GymCrm.Api.Auth.ClientMembershipAudit;
using static GymCrm.Api.Auth.ClientMembershipRequestValidation;

namespace GymCrm.Api.Auth;

internal static class ClientMembershipEndpoints
{
    private const int MembershipIdempotencyKeyMaxLength = 128;

    internal static RouteGroupBuilder MapClientMembershipEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/membership/purchase", PurchaseMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/renew", RenewMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/correct", CorrectMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/targets/transfer/preview", PreviewMembershipTargetTransferAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/targets/transfer", TransferMembershipTargetsAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/mark-payment", MarkMembershipPaymentAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/sales/{saleId:guid}/refunds", RegisterMembershipRefundAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}/membership/sales/{saleId:guid}/comment", UpdateMembershipCommentAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/refunds/{refundId:guid}/cancel", CancelMembershipRefundAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);

        return group;
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> PurchaseMembershipAsync(
        Guid id,
        PurchaseClientMembershipRequest request,
        HttpContext httpContext,
        IClientMembershipExecutionWorkflow executionWorkflow,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var removedPaymentMarker = CreateRemovedPaymentMarkerProblem(request.PaymentStatus, request.IsPaid);
        if (removedPaymentMarker is not null)
        {
            return removedPaymentMarker;
        }

        return await ExecuteMembershipActionAsync(
            id,
            httpContext,
            executionWorkflow,
            businessDateProvider,
            antiforgery,
            cancellationToken,
            validateRequest: _ => ValidatePurchaseMembershipRequest(request, businessDateProvider.Today),
            executeAsync: currentUser =>
                membershipService.PurchaseAsync(
                    id,
                    new CreateClientMembershipPurchaseCommand(
                        currentUser.Id,
                        request.MembershipCatalogItemId,
                        ParseIsoDate(request.ValidFrom),
                        ParseIsoDate(request.ValidTo),
                        ParseIsoDate(request.PaymentDate)!.Value,
                        request.TargetGroupIds ?? [],
                        request.ProfessionalComment,
                        request.ManualSaleAmount),
                    cancellationToken),
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.MembershipPurchasedAction,
                request.MembershipCatalogItemId,
                ValidFrom = NormalizeIsoDateForIdempotency(request.ValidFrom),
                ValidTo = NormalizeIsoDateForIdempotency(request.ValidTo),
                PaymentDate = NormalizeIsoDateForIdempotency(request.PaymentDate),
                TargetGroupIds = request.TargetGroupIds ?? [],
                ProfessionalComment = NormalizeOptionalText(request.ProfessionalComment),
                request.ManualSaleAmount
            },
            actionType: ClientAuditConstants.MembershipPurchasedAction,
            descriptionFactory: ClientAuditResources.MembershipPurchasedDescription,
            lockGroupIds: request.TargetGroupIds ?? []);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateMembershipCommentAsync(
        Guid id, Guid saleId, UpdateClientMembershipCommentRequest request, HttpContext httpContext,
        GymCrmDbContext dbContext, IClientMembershipService membershipService, IAuditLogService auditLogService,
        IBusinessDateProvider businessDateProvider, ILoggerFactory loggerFactory, IAntiforgery antiforgery, CancellationToken cancellationToken)
    {
        var csrf = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrf is not null) return csrf;
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null) return TypedResults.Unauthorized();
        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken)) return TypedResults.NotFound();
        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(dbContext, currentUser.Id, id, [], [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null) return TypedResults.Unauthorized();
        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken)) return TypedResults.NotFound();
        string? normalized;
        try { normalized = ClientMembershipCommentPolicy.Normalize(request.Comment); }
        catch (ArgumentException)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["comment"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine1243117a1d9] });
        }

        var mutation = await membershipService.UpdateCommentAsync(id, saleId,
            new UpdateClientMembershipCommentCommand(currentUser.Id, normalized), cancellationToken);
        if (!mutation.Found) return TypedResults.NotFound();

        if (mutation.Transition is not null)
        {
            var entry = new AuditLogEntry(currentUser.Id, ClientAuditConstants.MembershipCommentChangedAction,
                ClientAuditConstants.MembershipSaleEntityType, saleId.ToString(),
                ClientAuditResources.MembershipCommentChangedDescription(currentUser.Login),
                NewValueJson: JsonSerializer.Serialize(new { clientId = id, saleId, transition = mutation.Transition }, AuditSerializerOptions));
            await WriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, id, entry, cancellationToken);
        }

        var client = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found.");
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
            await transaction.DisposeAsync();
        }
        var responseClient = await LoadAuthorizedMutationSnapshotAsync(id, currentUser.Id, dbContext, cancellationToken);
        return responseClient is null ? TypedResults.NotFound() : TypedResults.Ok(ClientResponseMapper.MapDetails(responseClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today, loggerFactory.CreateLogger("ClientMembershipCommentMetadata")));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> RenewMembershipAsync(
        Guid id,
        RenewClientMembershipRequest request,
        HttpContext httpContext,
        IClientMembershipExecutionWorkflow executionWorkflow,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var removedPaymentMarker = CreateRemovedPaymentMarkerProblem(request.PaymentStatus, request.IsPaid);
        if (removedPaymentMarker is not null)
        {
            return removedPaymentMarker;
        }

        return await ExecuteMembershipActionAsync(
            id,
            httpContext,
            executionWorkflow,
            businessDateProvider,
            antiforgery,
            cancellationToken,
            validateRequest: clientBefore => ValidateRenewMembershipRequest(request, clientBefore, businessDateProvider.Today),
            executeAsync: currentUser =>
                membershipService.RenewAsync(
                    id,
                    new RenewClientMembershipCommand(
                        currentUser.Id,
                        request.MembershipCatalogItemId,
                        ParseIsoDate(request.PaymentDate)!.Value,
                        request.SaleId!.Value,
                        request.ExpectedMembershipId!.Value,
                        request.TargetGroupIds ?? [],
                        request.ProfessionalComment,
                        request.ManualSaleAmount),
                    cancellationToken),
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.MembershipRenewedAction,
                request.MembershipCatalogItemId,
                PaymentDate = NormalizeIsoDateForIdempotency(request.PaymentDate),
                request.SaleId,
                request.ExpectedMembershipId,
                TargetGroupIds = request.TargetGroupIds ?? [],
                ProfessionalComment = NormalizeOptionalText(request.ProfessionalComment),
                request.ManualSaleAmount
            },
            actionType: ClientAuditConstants.MembershipRenewedAction,
            descriptionFactory: ClientAuditResources.MembershipRenewedDescription,
            lockGroupIds: request.TargetGroupIds ?? []);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CorrectMembershipAsync(
        Guid id,
        CorrectClientMembershipRequest request,
        HttpContext httpContext,
        IClientMembershipExecutionWorkflow executionWorkflow,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return ExecuteMembershipActionAsync(
            id,
            httpContext,
            executionWorkflow,
            businessDateProvider,
            antiforgery,
            cancellationToken,
            validateRequest: clientBefore =>
                ValidateCorrectMembershipRequest(request, clientBefore, businessDateProvider.Today),
            executeAsync: currentUser =>
                membershipService.CorrectAsync(
                    id,
                    new CorrectClientMembershipCommand(
                        currentUser.Id,
                        request.SaleId!.Value,
                        request.ExpectedMembershipId!.Value,
                        ParseIsoDate(request.ValidFrom),
                        ParseIsoDate(request.ValidTo),
                        ParseIsoDate(request.PaymentDate)!.Value,
                        request.TargetGroupIds ?? []),
                    cancellationToken),
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.MembershipCorrectedAction,
                request.SaleId,
                request.ExpectedMembershipId,
                ValidFrom = NormalizeIsoDateForIdempotency(request.ValidFrom),
                ValidTo = NormalizeIsoDateForIdempotency(request.ValidTo),
                PaymentDate = NormalizeIsoDateForIdempotency(request.PaymentDate),
                TargetGroupIds = request.TargetGroupIds ?? []
            },
            actionType: ClientAuditConstants.MembershipCorrectedAction,
            descriptionFactory: ClientAuditResources.MembershipCorrectedDescription,
            lockGroupIds: request.TargetGroupIds ?? []);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> MarkMembershipPaymentAsync(
        Guid id,
        MarkMembershipPaymentRequest request,
        HttpContext httpContext,
        ILoggerFactory loggerFactory,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        if (httpContext.GetAuthenticatedGymCrmUser() is null)
        {
            return TypedResults.Unauthorized();
        }

        return CreateProblem(
            StatusCodes.Status410Gone,
            "membership-payment-action-removed",
            "Membership payment action was removed.",
            new Dictionary<string, string[]> { ["membership"] = ["Membership payment action was removed."] });
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> RegisterMembershipRefundAsync(
        Guid id,
        Guid saleId,
        CreateClientMembershipRefundRequest request,
        HttpContext httpContext,
        IClientMembershipRefundExecutionWorkflow executionWorkflow,
        IClientMembershipService membershipService,
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

        var result = await executionWorkflow.ExecuteAsync(new ClientMembershipRefundExecutionOperation(
            id, currentUser, GetMembershipIdempotencyKey(httpContext.Request),
            () => new
            {
                ClientId = id,
                SaleId = saleId,
                RefundDate = ParseIsoDate(request.RefundDate)!.Value,
                Amount = request.Amount!.Value,
                Comment = NormalizeOptionalText(request.Comment)
            },
            ClientAuditConstants.MembershipRefundCreatedAction,
            () => ValidateRefundRequest(request),
            actor => membershipService.RegisterRefundAsync(id, new RegisterClientMembershipRefundCommand(
                actor.Id, saleId, ParseIsoDate(request.RefundDate)!.Value, request.Amount!.Value, NormalizeOptionalText(request.Comment)), cancellationToken),
            (actor, after, mutation) => new AuditLogEntry(actor.Id, ClientAuditConstants.MembershipRefundCreatedAction,
                ClientAuditConstants.MembershipRefundEntityType, mutation.Refund!.Id.ToString(),
                ClientAuditResources.MembershipRefundCreatedDescription(actor.Login, BuildClientFullName(after.LastName, after.FirstName, after.MiddleName)),
                null, SerializeRefundAuditState(mutation.Refund)),
            saleId), cancellationToken);
        return await MapRefundExecutionResultAsync(result, executionWorkflow, businessDateProvider, cancellation: false);
    }

    private static async Task<Results<Ok<MembershipTargetTransferPreviewResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> PreviewMembershipTargetTransferAsync(
        Guid id,
        MembershipTargetTransferRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipTargetTransferService transferService,
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

        await using var readTransaction = await ClientAccessTransaction.BeginReadAsync(dbContext, currentUser.Id, [id], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }
        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return TypedResults.NotFound();
        }

        var preview = await transferService.PreviewAsync(
            id,
            new ClientMembershipTargetTransferCommand(
                currentUser.Id,
                request.SourceGroupId,
                request.TargetGroupId,
                request.ExpectedMembershipIds ?? []),
            cancellationToken);
        return MapTransferPreviewResult(preview);
    }

    private static async Task<IResult> TransferMembershipTargetsAsync(
        Guid id,
        MembershipTargetTransferRequest request,
        HttpContext httpContext,
        IClientMembershipTargetExecutionWorkflow executionWorkflow,
        IClientMembershipTargetTransferService transferService,
        IBusinessDateProvider businessDateProvider,
        ILoggerFactory loggerFactory,
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

        var actionType = ClientAuditConstants.MembershipTargetsTransferredAction;
        var result = await executionWorkflow.ExecuteAsync(new ClientMembershipTargetExecutionOperation(
            id, currentUser, GetMembershipIdempotencyKey(httpContext.Request),
            () => new
            {
                ClientId = id,
                Action = actionType,
                request.SourceGroupId,
                request.TargetGroupId,
                ExpectedMembershipIds = request.ExpectedMembershipIds ?? []
            },
            actionType,
            actor => transferService.TransferAsync(id, new ClientMembershipTargetTransferCommand(
                actor.Id, request.SourceGroupId, request.TargetGroupId, request.ExpectedMembershipIds ?? []), cancellationToken),
            (actor, before, after) => new AuditLogEntry(actor.Id, actionType,
                ClientAuditConstants.MembershipEntityType, id.ToString(),
                global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine63016aaa323(
                    actor.Login, BuildClientFullName(after.LastName, after.FirstName, after.MiddleName)),
                SerializeMembershipCollectionAuditState(before.Memberships), SerializeMembershipCollectionAuditState(after.Memberships)),
            new[] { request.SourceGroupId, request.TargetGroupId }.OfType<Guid>().ToArray()), cancellationToken);
        if (result.Status == ClientMutationExecutionStatus.Success)
        {
            if (result.IsReplay)
                return TypedResults.Ok(ClientResponseMapper.MapDetails(result.Client!, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
            try
            {
                return TypedResults.Ok(ClientResponseMapper.MapDetails(result.Client!, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
            }
            catch (Exception exception)
            {
                await executionWorkflow.CleanupFailedResultAsync(result.ReservationId);
                loggerFactory.CreateLogger("GymCrm.Api.Auth.ClientMembershipTargetTransfer").LogError(
                    "Membership target transfer failed before commit. ExceptionType: {ExceptionType}", exception.GetType().Name);
                return TargetExecutionFailure();
            }
        }
        return result.Status switch
        {
            ClientMutationExecutionStatus.NotFound => TypedResults.NotFound(),
            ClientMutationExecutionStatus.MissingIdempotencyKey => TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Idempotency-Key header is required for this membership operation."]
            }),
            ClientMutationExecutionStatus.IdempotencyConflict => CreateProblem(
                StatusCodes.Status409Conflict, "idempotency-conflict", "Idempotency key was already used for another membership operation.",
                new Dictionary<string, string[]> { ["idempotencyKey"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine5183eeff138] }),
            ClientMutationExecutionStatus.InProgress or ClientMutationExecutionStatus.InProgressAfterReservationCollision => CreateProblem(
                StatusCodes.Status409Conflict, "membership-operation-in-progress", "Membership operation is still in progress.",
                new Dictionary<string, string[]>
                {
                    ["idempotencyKey"] = [result.Status == ClientMutationExecutionStatus.InProgress
                    ? global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine527339319fd
                    : global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine584339319fd]
                }),
            ClientMutationExecutionStatus.Rejected => MapTransferProblemResult(result.Failure),
            ClientMutationExecutionStatus.Failed => TargetExecutionFailure(),
            _ => throw new InvalidOperationException("Unexpected target transfer execution result.")
        };
    }

    private static ProblemHttpResult TargetExecutionFailure() => CreateProblem(
        StatusCodes.Status500InternalServerError, "membership-operation-failed", "Membership operation failed.",
        new Dictionary<string, string[]> { ["membership"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine6611c294390] });

    private static Results<Ok<MembershipTargetTransferPreviewResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult> MapTransferPreviewResult(
        ClientMembershipTargetTransferResult result)
    {
        if (result.Succeeded)
        {
            return TypedResults.Ok(MapTransferPreviewResponse(result.Preview!));
        }

        if (result.Status == ClientMembershipTargetTransferStatus.ClientMissing)
        {
            return TypedResults.NotFound();
        }

        if (result.Status is ClientMembershipTargetTransferStatus.InvalidRequest
            or ClientMembershipTargetTransferStatus.TargetUnavailable
            or ClientMembershipTargetTransferStatus.CrossBranchTarget)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                [result.Field ?? "targetGroupIds"] = [result.Message ?? global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine69145ea1663]
            });
        }

        return MapTransferProblemResult(result);
    }

    private static ProblemHttpResult MapTransferProblemResult(
        ClientMembershipTargetTransferResult result)
    {
        var field = result.Field ?? "targetGroupId";
        var message = result.Message ?? global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine702E708b0d9;
        return result.Status switch
        {
            ClientMembershipTargetTransferStatus.StaleExpectedMemberships => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-target-conflict",
                "Membership target is stale.",
                new Dictionary<string, string[]> { [field] = [message] }),
            ClientMembershipTargetTransferStatus.DuplicateTarget => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-target-conflict",
                "Membership target transfer creates duplicate target.",
                new Dictionary<string, string[]> { [field] = [message] }),
            ClientMembershipTargetTransferStatus.MembershipOverlap => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-overlap",
                "Membership target transfer creates overlap.",
                new Dictionary<string, string[]> { [field] = [message] }),
            ClientMembershipTargetTransferStatus.MembershipTargetMissing => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-target-missing",
                "Membership target is missing.",
                new Dictionary<string, string[]> { [field] = [message] }),
            ClientMembershipTargetTransferStatus.ClientMissing => CreateProblem(
                StatusCodes.Status404NotFound,
                "client-not-found",
                "Client was not found.",
                new Dictionary<string, string[]> { ["clientId"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine7293e0cd008] }),
            _ => CreateProblem(
                StatusCodes.Status400BadRequest,
                "membership-target-invalid",
                "Membership target transfer request is invalid.",
                new Dictionary<string, string[]> { [field] = [message] })
        };
    }

    private static MembershipTargetTransferPreviewResponse MapTransferPreviewResponse(
        ClientMembershipTargetTransferPreviewResult preview)
    {
        return new MembershipTargetTransferPreviewResponse(
            preview.ClientId,
            preview.SourceGroupId,
            preview.TargetGroupId,
            preview.AffectedMemberships
                .Select(item => new MembershipTargetTransferItemResponse(
                    item.MembershipId,
                    item.SaleId,
                    item.MembershipName,
                    item.BehaviorKind.ToString(),
                    MapTransferTargets(item.BeforeTargets),
                    MapTransferTargets(item.AfterTargets)))
                .ToArray());
    }

    private static IReadOnlyList<ClientMembershipTargetGroupResponse> MapTransferTargets(
        IEnumerable<ClientMembershipTargetSnapshotResult> targets)
    {
        return targets
            .OrderBy(target => target.Position)
            .Select(target => new ClientMembershipTargetGroupResponse(
                target.GroupId,
                target.GroupName,
                target.BranchId,
                target.BranchName,
                target.Position,
                target.IsActive))
            .ToArray();
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CancelMembershipRefundAsync(
        Guid id,
        Guid refundId,
        HttpContext httpContext,
        IClientMembershipRefundExecutionWorkflow executionWorkflow,
        IClientMembershipService membershipService,
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

        var result = await executionWorkflow.ExecuteAsync(new ClientMembershipRefundExecutionOperation(
            id, currentUser, GetMembershipIdempotencyKey(httpContext.Request),
            () => new { ClientId = id, RefundId = refundId },
            ClientAuditConstants.MembershipRefundCanceledAction,
            null,
            actor => membershipService.CancelRefundAsync(id, new CancelClientMembershipRefundCommand(actor.Id, refundId), cancellationToken),
            (actor, after, mutation) => new AuditLogEntry(actor.Id, ClientAuditConstants.MembershipRefundCanceledAction,
                ClientAuditConstants.MembershipRefundEntityType, mutation.Refund!.Id.ToString(),
                ClientAuditResources.MembershipRefundCanceledDescription(actor.Login, BuildClientFullName(after.LastName, after.FirstName, after.MiddleName)),
                mutation.PreviousRefund is null ? null : SerializeRefundAuditState(mutation.PreviousRefund), SerializeRefundAuditState(mutation.Refund)),
            null), cancellationToken);
        return await MapRefundExecutionResultAsync(result, executionWorkflow, businessDateProvider, cancellation: true);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> MapRefundExecutionResultAsync(
        ClientMutationExecutionResult<ClientMembershipRefundMutationError> result,
        IClientMembershipRefundExecutionWorkflow executionWorkflow,
        IBusinessDateProvider businessDateProvider,
        bool cancellation)
    {
        if (result.Status == ClientMutationExecutionStatus.Success)
        {
            // Replay mapping historically occurs outside the mutation error boundary.
            if (result.IsReplay)
                return TypedResults.Ok(ClientResponseMapper.MapDetails(result.Client!, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
            try
            {
                return TypedResults.Ok(ClientResponseMapper.MapDetails(result.Client!, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
            }
            catch
            {
                await executionWorkflow.CleanupFailedResultAsync(result.ReservationId);
                return RefundExecutionFailure(cancellation);
            }
        }
        return result.Status switch
        {
            ClientMutationExecutionStatus.NotFound => TypedResults.NotFound(),
            ClientMutationExecutionStatus.InvalidRequest => TypedResults.ValidationProblem(result.ValidationErrors!),
            ClientMutationExecutionStatus.MissingIdempotencyKey => TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Idempotency-Key header is required for this membership operation."]
            }),
            ClientMutationExecutionStatus.IdempotencyConflict => CreateProblem(
                StatusCodes.Status409Conflict, "idempotency-conflict", "Idempotency key was already used for another membership operation.",
                new Dictionary<string, string[]> { ["idempotencyKey"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine9203eeff138] }),
            ClientMutationExecutionStatus.InProgress => CreateProblem(
                StatusCodes.Status409Conflict, "membership-operation-in-progress", "Membership operation is still in progress.",
                new Dictionary<string, string[]> { ["idempotencyKey"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine929339319fd] }),
            ClientMutationExecutionStatus.Rejected => MapRefundMutationError(result.Failure),
            ClientMutationExecutionStatus.Failed => RefundExecutionFailure(cancellation),
            _ => throw new InvalidOperationException("Unexpected refund execution result.")
        };
    }

    private static ProblemHttpResult RefundExecutionFailure(bool cancellation) => CreateProblem(
        StatusCodes.Status500InternalServerError, "membership-refund-operation-failed", "Membership refund operation failed.",
        new Dictionary<string, string[]>
        {
            ["refund"] = [cancellation
            ? global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine8792a8c74ae
            : global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine4088cf17618]
        });

    internal static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ExecuteMembershipActionAsync(
        Guid id,
        HttpContext httpContext,
        IClientMembershipExecutionWorkflow executionWorkflow,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken,
        Func<Client, Dictionary<string, string[]>> validateRequest,
        Func<User, Task<ClientMembershipMutationResult>> executeAsync,
        object idempotencyPayload,
        string actionType,
        Func<string, string, string> descriptionFactory,
        Func<User, Client, Client, ClientMembershipMutationResult, IReadOnlyList<AuditLogEntry>>? createAuditEntries = null,
        IReadOnlyCollection<Guid>? lockGroupIds = null,
        IReadOnlyCollection<Guid>? lockBranchIds = null,
        Func<Task<Dictionary<string, string[]>>>? validateLockedAsync = null)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null) return csrfValidationResult;
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null) return TypedResults.Unauthorized();

        var result = await executionWorkflow.ExecuteAsync(new ClientMembershipExecutionOperation(
            id, currentUser, GetMembershipIdempotencyKey(httpContext.Request), () => idempotencyPayload,
            actionType, validateRequest, executeAsync,
            (actor, before, after, mutation) => CreateMembershipExecutionAuditEntries(
                actor, before, after, mutation, actionType, descriptionFactory, createAuditEntries),
            lockGroupIds ?? [], lockBranchIds ?? [], validateLockedAsync), cancellationToken);
        return result.Status switch
        {
            ClientMutationExecutionStatus.Success => TypedResults.Ok(ClientResponseMapper.MapDetails(
                result.Client!, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today)),
            ClientMutationExecutionStatus.CompletedWithoutVisibleClient => TypedResults.NoContent(),
            ClientMutationExecutionStatus.NotFound => TypedResults.NotFound(),
            ClientMutationExecutionStatus.InvalidRequest => TypedResults.ValidationProblem(result.ValidationErrors!),
            ClientMutationExecutionStatus.MissingIdempotencyKey => TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Idempotency-Key header is required for this membership operation."]
            }),
            ClientMutationExecutionStatus.IdempotencyConflict => CreateProblem(
                StatusCodes.Status409Conflict, "idempotency-conflict", "Idempotency key was already used for another membership operation.",
                new Dictionary<string, string[]> { ["idempotencyKey"] = ["Idempotency key was already used with different membership content."] }),
            ClientMutationExecutionStatus.InProgress => CreateProblem(
                StatusCodes.Status409Conflict, "membership-operation-in-progress", "Membership operation is still in progress.",
                new Dictionary<string, string[]> { ["idempotencyKey"] = ["The same membership operation is still in progress. Retry later."] }),
            ClientMutationExecutionStatus.Rejected => MapMembershipMutationError(result.Failure),
            ClientMutationExecutionStatus.Failed => CreateProblem(
                StatusCodes.Status500InternalServerError, "membership-operation-failed", "Membership operation failed.",
                new Dictionary<string, string[]> { ["membership"] = ["Membership operation failed."] }),
            _ => throw new InvalidOperationException("Unexpected membership execution result.")
        };
    }

    private static IReadOnlyList<AuditLogEntry> CreateMembershipExecutionAuditEntries(
        User actor, Client before, Client after, ClientMembershipMutationResult mutation,
        string actionType, Func<string, string, string> descriptionFactory,
        Func<User, Client, Client, ClientMembershipMutationResult, IReadOnlyList<AuditLogEntry>>? createAuditEntries)
    {
        var entries = createAuditEntries is null
            ? new List<AuditLogEntry>
            {
                new(actor.Id, actionType, ClientAuditConstants.MembershipEntityType,
                    mutation.Details?.CurrentMembership?.Id.ToString() ?? after.Id.ToString(),
                    descriptionFactory(actor.Login, BuildClientFullName(after.LastName, after.FirstName, after.MiddleName)),
                    SerializeMembershipCollectionAuditState(before.Memberships),
                    SerializeMembershipCollectionAuditState(after.Memberships))
            }
            : createAuditEntries(actor, before, after, mutation).ToList();
        if (mutation.SaleAudit is not null)
        {
            entries.Add(new AuditLogEntry(actor.Id, ClientAuditConstants.MembershipSaleCorrectedAction,
                ClientAuditConstants.MembershipSaleEntityType, mutation.SaleAudit.NewSale.Id.ToString(),
                ClientAuditResources.MembershipSaleCorrectedDescription(
                    actor.Login, BuildClientFullName(after.LastName, after.FirstName, after.MiddleName)),
                SerializeSaleAuditState(mutation.SaleAudit.OldSale), SerializeSaleAuditState(mutation.SaleAudit.NewSale)));
        }
        return entries;
    }

    internal static string? GetMembershipIdempotencyKey(HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Idempotency-Key", out var values))
        {
            return null;
        }

        if (values.Count != 1)
        {
            return null;
        }

        var value = values.ToString().Trim();
        return string.IsNullOrWhiteSpace(value) || value.Length > MembershipIdempotencyKeyMaxLength
            ? null
            : value;
    }

    internal static string? NormalizeIsoDateForIdempotency(string? value)
    {
        return ParseIsoDate(value)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>
        MapMembershipMutationError(ClientMembershipMutationError error)
    {
        return error switch
        {
            ClientMembershipMutationError.ClientMissing or
            ClientMembershipMutationError.MembershipTargetMissing => TypedResults.NotFound(),
            ClientMembershipMutationError.MembershipOverlap or
            ClientMembershipMutationError.ActiveMembershipExists => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-overlap",
                "Membership period overlaps another membership.",
                new Dictionary<string, string[]> { ["membership"] = [ClientResources.MembershipChangeFailed] }),
            ClientMembershipMutationError.MembershipTargetConflict => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-target-conflict",
                "Membership target is stale.",
                new Dictionary<string, string[]> { ["expectedMembershipId"] = ["Target membership version is no longer current. Reload the client card and retry."] }),
            ClientMembershipMutationError.MembershipTargetsInvalid => TypedResults.ValidationProblem(
                new Dictionary<string, string[]> { ["targetGroupIds"] = ["Membership target groups are invalid."] }),
            ClientMembershipMutationError.BranchTransferMembershipTargetsAffected => CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-target-conflict",
                "Branch transfer would detach active or future membership targets.",
                new Dictionary<string, string[]>
                {
                    ["targetGroupIds"] = [global::GymCrm.Api.UserFacingText.BE3ClientMembershipText.ClientMembershipEndpointsLine1374E266e0bf]
                }),
            _ => TypedResults.ValidationProblem(CreateMembershipOperationError(error))
        };
    }
}
