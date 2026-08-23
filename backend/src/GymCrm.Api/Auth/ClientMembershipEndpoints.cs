using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using static GymCrm.Api.Auth.ClientEndpointSharedHelpers;
using static GymCrm.Api.Auth.ClientMembershipAudit;
using static GymCrm.Api.Auth.ClientMembershipRequestValidation;

namespace GymCrm.Api.Auth;

internal static class ClientMembershipEndpoints
{
    private const int MembershipIdempotencyKeyMaxLength = 128;
    private const string MembershipIdempotencyPending = "Pending";
    private const string MembershipIdempotencyCompleted = "Completed";

    internal static RouteGroupBuilder MapClientMembershipEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/membership/purchase", PurchaseMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/renew", RenewMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/correct", CorrectMembershipAsync)
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

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> PurchaseMembershipAsync(
        Guid id,
        PurchaseClientMembershipRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        IServiceScopeFactory serviceScopeFactory,
        ILoggerFactory loggerFactory,
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
            dbContext,
            businessDateProvider,
            auditLogService,
            serviceScopeFactory,
            loggerFactory,
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
                ProfessionalComment = NormalizeOptionalText(request.ProfessionalComment),
                request.ManualSaleAmount
            },
            actionType: ClientAuditConstants.MembershipPurchasedAction,
            descriptionFactory: ClientAuditResources.MembershipPurchasedDescription);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateMembershipCommentAsync(
        Guid id, Guid saleId, UpdateClientMembershipCommentRequest request, HttpContext httpContext,
        GymCrmDbContext dbContext, IClientMembershipService membershipService, IAuditLogService auditLogService,
        IBusinessDateProvider businessDateProvider, ILoggerFactory loggerFactory, IAntiforgery antiforgery, CancellationToken cancellationToken)
    {
        var csrf = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrf is not null) return csrf;
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null) return TypedResults.Unauthorized();
        string? normalized;
        try { normalized = ClientMembershipCommentPolicy.Normalize(request.Comment); }
        catch (ArgumentException)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["comment"] = ["Comment must not exceed 2000 characters."] });
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
            await TryWriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, id, entry, cancellationToken);
        }

        var client = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found.");
        return TypedResults.Ok(ClientResponseMapper.MapDetails(client, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today, loggerFactory.CreateLogger("ClientMembershipCommentMetadata")));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> RenewMembershipAsync(
        Guid id,
        RenewClientMembershipRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        IServiceScopeFactory serviceScopeFactory,
        ILoggerFactory loggerFactory,
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
            dbContext,
            businessDateProvider,
            auditLogService,
            serviceScopeFactory,
            loggerFactory,
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
                        request.ProfessionalComment,
                        request.ManualSaleAmount),
                    cancellationToken),
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.MembershipRenewedAction,
                request.MembershipCatalogItemId,
                PaymentDate = NormalizeIsoDateForIdempotency(request.PaymentDate),
                ProfessionalComment = NormalizeOptionalText(request.ProfessionalComment),
                request.ManualSaleAmount
            },
            actionType: ClientAuditConstants.MembershipRenewedAction,
            descriptionFactory: ClientAuditResources.MembershipRenewedDescription);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CorrectMembershipAsync(
        Guid id,
        CorrectClientMembershipRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        IServiceScopeFactory serviceScopeFactory,
        ILoggerFactory loggerFactory,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return ExecuteMembershipActionAsync(
            id,
            httpContext,
            dbContext,
            businessDateProvider,
            auditLogService,
            serviceScopeFactory,
            loggerFactory,
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
                        ParseIsoDate(request.PaymentDate)!.Value),
                    cancellationToken),
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.MembershipCorrectedAction,
                request.SaleId,
                request.ExpectedMembershipId,
                ValidFrom = NormalizeIsoDateForIdempotency(request.ValidFrom),
                ValidTo = NormalizeIsoDateForIdempotency(request.ValidTo),
                PaymentDate = NormalizeIsoDateForIdempotency(request.PaymentDate)
            },
            actionType: ClientAuditConstants.MembershipCorrectedAction,
            descriptionFactory: ClientAuditResources.MembershipCorrectedDescription);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> MarkMembershipPaymentAsync(
        Guid id,
        MarkMembershipPaymentRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        IServiceScopeFactory serviceScopeFactory,
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
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
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

        var clientBefore = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return TypedResults.NotFound();
        }

        var validationErrors = ValidateRefundRequest(request);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var mutationResult = await membershipService.RegisterRefundAsync(
            id,
            new RegisterClientMembershipRefundCommand(
                currentUser.Id,
                saleId,
                ParseIsoDate(request.RefundDate)!.Value,
                request.Amount!.Value,
                NormalizeOptionalText(request.Comment)),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            return MapRefundMutationError(mutationResult.Error);
        }

        var clientAfter = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership refund registration.");
        var refund = mutationResult.Refund
            ?? throw new InvalidOperationException("Membership refund mutation succeeded without a refund snapshot.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.MembershipRefundCreatedAction,
                ClientAuditConstants.MembershipRefundEntityType,
                refund.Id.ToString(),
                ClientAuditResources.MembershipRefundCreatedDescription(
                    currentUser.Login,
                    BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                NewValueJson: SerializeRefundAuditState(refund)),
            cancellationToken);

        return TypedResults.Ok(ClientResponseMapper.MapDetails(clientAfter, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CancelMembershipRefundAsync(
        Guid id,
        Guid refundId,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
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

        var clientBefore = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return TypedResults.NotFound();
        }

        var mutationResult = await membershipService.CancelRefundAsync(
            id,
            new CancelClientMembershipRefundCommand(currentUser.Id, refundId),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            return MapRefundMutationError(mutationResult.Error);
        }

        var clientAfter = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership refund cancellation.");
        var refund = mutationResult.Refund
            ?? throw new InvalidOperationException("Membership refund cancellation succeeded without a refund snapshot.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.MembershipRefundCanceledAction,
                ClientAuditConstants.MembershipRefundEntityType,
                refund.Id.ToString(),
                ClientAuditResources.MembershipRefundCanceledDescription(
                    currentUser.Login,
                    BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                mutationResult.PreviousRefund is null ? null : SerializeRefundAuditState(mutationResult.PreviousRefund),
                SerializeRefundAuditState(refund)),
            cancellationToken);

        return TypedResults.Ok(ClientResponseMapper.MapDetails(clientAfter, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }

    internal static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ExecuteMembershipActionAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        IServiceScopeFactory serviceScopeFactory,
        ILoggerFactory loggerFactory,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken,
        Func<Client, Dictionary<string, string[]>> validateRequest,
        Func<User, Task<ClientMembershipMutationResult>> executeAsync,
        object idempotencyPayload,
        string actionType,
        Func<string, string, string> descriptionFactory,
        Func<User, Client, Client, ClientMembershipMutationResult, Task>? writeAuditAsync = null)
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

        var clientBefore = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return TypedResults.NotFound();
        }

        var validationErrors = validateRequest(clientBefore);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var idempotencyKey = GetMembershipIdempotencyKey(httpContext.Request);
        if (idempotencyKey is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Idempotency-Key header is required for this membership operation."]
            });
        }

        var payloadHash = ComputeMembershipIdempotencyPayloadHash(idempotencyPayload);
        var now = DateTimeOffset.UtcNow;
        var logger = loggerFactory.CreateLogger("GymCrm.Api.Auth.ClientMembershipMutation");
        async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>?> HandleExistingIdempotencyAsync(
            ClientMembershipIdempotencyRecord record)
        {
            if (record.ExpiresAt <= now)
            {
                dbContext.ClientMembershipIdempotencyRecords.Remove(record);
                await dbContext.SaveChangesAsync(cancellationToken);
                return null;
            }

            if (!string.Equals(record.PayloadHash, payloadHash, StringComparison.Ordinal) ||
                !string.Equals(record.ActionType, actionType, StringComparison.Ordinal))
            {
                return CreateProblem(
                    StatusCodes.Status409Conflict,
                    "idempotency-conflict",
                    "Idempotency key was already used for another membership operation.",
                    new Dictionary<string, string[]> { ["idempotencyKey"] = ["Idempotency key was already used with different membership content."] });
            }

            if (string.Equals(record.Status, MembershipIdempotencyPending, StringComparison.Ordinal))
            {
                return CreateProblem(
                    StatusCodes.Status409Conflict,
                    "membership-operation-in-progress",
                    "Membership operation is still in progress.",
                    new Dictionary<string, string[]> { ["idempotencyKey"] = ["The same membership operation is still in progress. Retry later."] });
            }

            var replayClient = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated client '{id}' was not found during membership idempotency replay.");
            return TypedResults.Ok(ClientResponseMapper.MapDetails(replayClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
        }

        var existingIdempotency = await dbContext.ClientMembershipIdempotencyRecords
            .SingleOrDefaultAsync(
                record =>
                    record.ActorUserId == currentUser.Id &&
                    record.IdempotencyKey == idempotencyKey,
                cancellationToken);
        if (existingIdempotency is not null)
        {
            var existingResult = await HandleExistingIdempotencyAsync(existingIdempotency);
            if (existingResult is not null)
            {
                return existingResult;
            }
        }

        var reservedIdempotency = new ClientMembershipIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            ActorUserId = currentUser.Id,
            IdempotencyKey = idempotencyKey,
            ActionType = actionType,
            PayloadHash = payloadHash,
            Status = MembershipIdempotencyPending,
            ClientId = id,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now.AddDays(7)
        };
        dbContext.ClientMembershipIdempotencyRecords.Add(reservedIdempotency);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsMembershipIdempotencyUniqueException(exception))
        {
            dbContext.ChangeTracker.Clear();
            var winningRecord = await dbContext.ClientMembershipIdempotencyRecords
                .SingleAsync(
                    record =>
                        record.ActorUserId == currentUser.Id &&
                        record.IdempotencyKey == idempotencyKey,
                    cancellationToken);
            var winningResult = await HandleExistingIdempotencyAsync(winningRecord);
            if (winningResult is not null)
            {
                return winningResult;
            }

            return CreateProblem(
                StatusCodes.Status409Conflict,
                "membership-operation-in-progress",
                "Membership operation is still in progress.",
                new Dictionary<string, string[]> { ["idempotencyKey"] = ["The same membership operation is still in progress. Retry later."] });
        }

        async Task DeleteReservedIdempotencyAsync()
        {
            await using var cleanupScope = serviceScopeFactory.CreateAsyncScope();
            var cleanupDbContext = cleanupScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var record = await cleanupDbContext.ClientMembershipIdempotencyRecords
                .SingleOrDefaultAsync(
                    candidate =>
                        candidate.ActorUserId == currentUser.Id &&
                        candidate.IdempotencyKey == idempotencyKey,
                    cancellationToken);
            if (record is not null)
            {
                cleanupDbContext.ClientMembershipIdempotencyRecords.Remove(record);
                await cleanupDbContext.SaveChangesAsync(cancellationToken);
            }
        }

        var transaction = await BeginMembershipActionTransactionAsync(dbContext, cancellationToken);
        async Task RollbackAndDisposeTransactionAsync()
        {
            if (transaction is not null)
            {
                var transactionToRollback = transaction;
                transaction = null;
                try
                {
                    await RollbackMembershipActionTransactionAsync(transactionToRollback, cancellationToken);
                }
                finally
                {
                    await transactionToRollback.DisposeAsync();
                }
            }
        }

        try
        {
            var mutationResult = await executeAsync(currentUser);
            if (!mutationResult.Succeeded)
            {
                await RollbackAndDisposeTransactionAsync();
                await DeleteReservedIdempotencyAsync();
                if (mutationResult.Error == ClientMembershipMutationError.ClientMissing)
                {
                    return TypedResults.NotFound();
                }

                return MapMembershipMutationError(mutationResult.Error);
            }

            var clientAfter = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership change.");
            var currentMembershipAfter = ClientResponseMapper.GetCurrentMembership(clientAfter);

            if (writeAuditAsync is not null)
            {
                await writeAuditAsync(currentUser, clientBefore, clientAfter, mutationResult);
            }
            else
            {
                await auditLogService.WriteAsync(
                    new AuditLogEntry(
                        currentUser.Id,
                        actionType,
                        ClientAuditConstants.MembershipEntityType,
                        currentMembershipAfter?.Id.ToString() ?? clientAfter.Id.ToString(),
                        descriptionFactory(
                            currentUser.Login,
                            BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                        SerializeMembershipAuditState(ClientResponseMapper.GetCurrentMembership(clientBefore)),
                        SerializeMembershipAuditState(currentMembershipAfter)),
                    cancellationToken);
            }

            if (mutationResult.SaleAudit is not null)
            {
                await auditLogService.WriteAsync(
                    new AuditLogEntry(
                        currentUser.Id,
                        ClientAuditConstants.MembershipSaleCorrectedAction,
                        ClientAuditConstants.MembershipSaleEntityType,
                        mutationResult.SaleAudit.NewSale.Id.ToString(),
                        ClientAuditResources.MembershipSaleCorrectedDescription(
                            currentUser.Login,
                            BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                        SerializeSaleAuditState(mutationResult.SaleAudit.OldSale),
                        SerializeSaleAuditState(mutationResult.SaleAudit.NewSale)),
                    cancellationToken);
            }

            var idempotency = await dbContext.ClientMembershipIdempotencyRecords.SingleAsync(
                record =>
                    record.ActorUserId == currentUser.Id &&
                    record.IdempotencyKey == idempotencyKey,
                cancellationToken);
            idempotency.Status = MembershipIdempotencyCompleted;
            idempotency.ResultMembershipId = currentMembershipAfter?.Id;
            idempotency.ResultSaleId = currentMembershipAfter?.SaleId;
            idempotency.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            await CommitMembershipActionTransactionAsync(transaction, cancellationToken);
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
                transaction = null;
            }

            return TypedResults.Ok(ClientResponseMapper.MapDetails(clientAfter, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
        }
        catch (Exception exception)
        {
            await RollbackAndDisposeTransactionAsync();
            await DeleteReservedIdempotencyAsync();
            logger.LogError(
                "Membership operation failed before commit. ActionType: {ActionType}; ExceptionType: {ExceptionType}",
                actionType,
                exception.GetType().Name);
            return CreateProblem(
                StatusCodes.Status500InternalServerError,
                "membership-operation-failed",
                "Membership operation failed.",
                new Dictionary<string, string[]> { ["membership"] = ["Membership operation failed."] });
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private static async Task<IDbContextTransaction?> BeginMembershipActionTransactionAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory" ||
               dbContext.Database.CurrentTransaction is not null
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private static async Task CommitMembershipActionTransactionAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }
    }

    private static async Task RollbackMembershipActionTransactionAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
        }
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

    private static string ComputeMembershipIdempotencyPayloadHash(object payload)
    {
        var json = JsonSerializer.Serialize(payload, AuditSerializerOptions);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    private static bool IsMembershipIdempotencyUniqueException(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException postgresException &&
               string.Equals(postgresException.SqlState, PostgresErrorCodes.UniqueViolation, StringComparison.Ordinal) &&
               string.Equals(
                   postgresException.ConstraintName,
                   GymCrmDbContext.ClientMembershipIdempotencyActorKeyIndexName,
                   StringComparison.Ordinal);
    }

    private static Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>
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
            _ => TypedResults.ValidationProblem(CreateMembershipOperationError(error))
        };
    }
}
