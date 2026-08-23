using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace GymCrm.Api.Auth;

internal static partial class ClientEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);
    private const int MembershipIdempotencyKeyMaxLength = 128;
    private const string MembershipIdempotencyPending = "Pending";
    private const string MembershipIdempotencyCompleted = "Completed";

    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients");

        group.MapClientQueryEndpoints();
        group.MapClientLifecycleEndpoints();
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

        return endpoints;
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

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ExecuteMembershipActionAsync(
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

    private static string? GetMembershipIdempotencyKey(HttpRequest request)
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

    private static string? NormalizeIsoDateForIdempotency(string? value)
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

    private static Dictionary<string, string[]> ValidatePurchaseMembershipRequest(PurchaseClientMembershipRequest request, DateOnly businessDate)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, errors);
        _ = ValidateOptionalDate(request.ValidFrom, "validFrom", errors);
        _ = ValidateOptionalDate(request.ValidTo, "validTo", errors);
        ValidateCatalogPayment(request.PaymentStatus, request.IsPaid, request.PaymentDate, businessDate, errors);

        return errors;
    }

    private static Dictionary<string, string[]> ValidateRenewMembershipRequest(
        RenewClientMembershipRequest request,
        Client client,
        DateOnly businessDate)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, errors);
        ValidateCatalogPayment(request.PaymentStatus, request.IsPaid, request.PaymentDate, businessDate, errors);

        return errors;
    }

    private static void ValidateCatalogPayment(
        string? status,
        bool? isPaid,
        string? paymentDate,
        DateOnly businessDate,
        Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            !string.Equals(status.Trim(), "Paid", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(status.Trim(), "Unpaid", StringComparison.OrdinalIgnoreCase))
        {
            errors["paymentStatus"] = ["Payment status is no longer accepted. Remove paymentStatus and send paymentDate."];
        }

        if (string.Equals(status?.Trim(), "Unpaid", StringComparison.OrdinalIgnoreCase) || isPaid == false)
        {
            errors["paymentStatus"] = ["Unpaid membership status was removed."];
        }

        ValidateRequiredPaymentDate(paymentDate, businessDate, errors);
    }

    private static ProblemHttpResult? CreateRemovedPaymentMarkerProblem(string? paymentStatus, bool? isPaid)
    {
        if (string.Equals(paymentStatus?.Trim(), "Unpaid", StringComparison.OrdinalIgnoreCase) || isPaid == false)
        {
            return CreateProblem(
                StatusCodes.Status400BadRequest,
                "membership-payment-status-removed",
                "Unpaid membership status was removed.",
                new Dictionary<string, string[]> { ["paymentStatus"] = ["Unpaid membership status was removed."] });
        }

        return null;
    }

    private static ProblemHttpResult CreateProblem(
        int statusCode,
        string type,
        string title,
        Dictionary<string, string[]> errors)
    {
        return TypedResults.Problem(new HttpValidationProblemDetails(errors)
        {
            Status = statusCode,
            Type = type,
            Title = title,
            Detail = title
        });
    }

    private static void ValidatePricingSelection(
        Guid? membershipCatalogItemId,
        decimal? manualSaleAmount,
        Dictionary<string, string[]> errors)
    {
        if (membershipCatalogItemId == Guid.Empty)
        {
            errors["membershipCatalogItemId"] = ["Membership catalog item id is invalid."];
        }

        if (!membershipCatalogItemId.HasValue && !manualSaleAmount.HasValue)
        {
            const string message = "Choose a catalog item or provide a manual sale amount.";
            errors["membershipCatalogItemId"] = [message];
            errors["manualSaleAmount"] = [message];
            return;
        }

        if (manualSaleAmount.HasValue &&
            !RubMoneyPolicy.IsWholeAmount(manualSaleAmount.Value, allowZero: false))
        {
            errors["manualSaleAmount"] =
                ["Manual sale amount must be a positive whole number of RUB within the supported range."];
        }
    }

    private static void ValidateAdditionalFields(
        IDictionary<string, JsonElement>? additionalFields,
        Dictionary<string, string[]> errors)
    {
        if (additionalFields is null)
        {
            return;
        }

        foreach (var field in additionalFields.Keys)
        {
            errors[field] = [$"Field '{field}' is not allowed for this operation."];
        }
    }

    private static Dictionary<string, string[]> ValidateCorrectMembershipRequest(
        CorrectClientMembershipRequest request,
        Client client,
        DateOnly businessDate)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidateRequiredGuid(request.SaleId, "saleId", errors);
        ValidateRequiredGuid(request.ExpectedMembershipId, "expectedMembershipId", errors);
        var validFrom = ValidateRequiredDate(request.ValidFrom, "validFrom", ClientResources.PurchaseDateRequired, errors);
        var validTo = ValidateOptionalDate(request.ValidTo, "validTo", errors);
        ValidateRequiredPaymentDate(request.PaymentDate, businessDate, errors);
        if (validFrom.HasValue && validTo.HasValue && validTo < validFrom)
            errors["validTo"] = [ClientResources.ExpirationBeforePurchaseDate];

        return errors;
    }

    private static void ValidateRequiredPaymentDate(
        string? paymentDate,
        DateOnly businessDate,
        Dictionary<string, string[]> errors)
    {
        var parsedPaymentDate = ValidateOptionalDate(paymentDate, "paymentDate", errors);
        if (errors.ContainsKey("paymentDate"))
        {
            return;
        }

        switch (ClientMembershipPaymentDatePolicy.Validate(parsedPaymentDate, businessDate))
        {
            case ClientMembershipPaymentDateValidationResult.Missing:
                errors["paymentDate"] = ["Payment date is required."];
                break;
            case ClientMembershipPaymentDateValidationResult.Future:
                errors["paymentDate"] = ["Payment date cannot be in the future."];
                break;
        }
    }

    private static Dictionary<string, string[]> ValidateRefundRequest(CreateClientMembershipRefundRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (!request.Amount.HasValue)
        {
            errors["amount"] = [ClientResources.RefundAmountRequired];
        }
        else if (!RubMoneyPolicy.IsWholeAmount(request.Amount.Value, allowZero: false))
        {
            errors["amount"] = ["Refund amount must be a positive whole number of RUB within the supported range."];
        }

        ValidateRequiredDate(request.RefundDate, "refundDate", ClientResources.RefundDateRequired, errors);

        var comment = NormalizeOptionalText(request.Comment);
        if (comment is not null && comment.Length > ClientMembershipRefund.CommentMaxLength)
        {
            errors["comment"] = [ClientResources.RefundCommentTooLong];
        }

        return errors;
    }

    private static void ValidateMembershipDateRange(
        MembershipBehaviorKind? behaviorKind,
        DateOnly? purchaseDate,
        DateOnly? expirationDate,
        Dictionary<string, string[]> errors,
        string expirationDateKey)
    {
        if (behaviorKind is MembershipBehaviorKind.SingleVisit || !purchaseDate.HasValue || !expirationDate.HasValue)
        {
            return;
        }

        if (expirationDate.Value < purchaseDate.Value)
        {
            errors[expirationDateKey] = [ClientResources.ExpirationBeforePurchaseDate];
        }
    }

    private static MembershipBehaviorKind? ValidateRequiredBehaviorKind(
        string? behaviorKind,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(behaviorKind))
        {
            errors["behaviorKind"] = [ClientResources.BehaviorKindRequired];
            return null;
        }

        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (parsedBehaviorKind is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
        }

        return parsedBehaviorKind;
    }

    private static void ValidateOptionalMatchingBehaviorKind(
        string? behaviorKind,
        MembershipBehaviorKind expectedBehaviorKind,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(behaviorKind))
        {
            return;
        }

        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (parsedBehaviorKind is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
            return;
        }

        if (parsedBehaviorKind.Value != expectedBehaviorKind)
        {
            errors["behaviorKind"] = [ClientResources.CurrentBehaviorKindMismatch(expectedBehaviorKind.ToString())];
        }
    }

    private static DateOnly? ValidateRequiredDate(
        string? value,
        string key,
        string requiredMessage,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[key] = [requiredMessage];
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (parsedDate is null)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static DateOnly? ValidateOptionalDate(
        string? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (parsedDate is null)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static void ValidateRequiredGuid(
        Guid? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (!value.HasValue || value.Value == Guid.Empty)
        {
            errors[key] = ["Identifier is required for this membership operation."];
        }
    }

    private static MembershipBehaviorKind? ParseBehaviorKind(string? behaviorKind)
    {
        return Enum.TryParse<MembershipBehaviorKind>(behaviorKind?.Trim(), ignoreCase: true, out var parsedBehaviorKind)
            ? parsedBehaviorKind
            : null;
    }

    private static DateOnly? ParseIsoDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate)
            ? parsedDate
            : null;
    }

    private static Dictionary<string, string[]> CreateMembershipOperationError(ClientMembershipMutationError error)
    {
        return error switch
        {
            ClientMembershipMutationError.InvalidRequest => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.InvalidMembershipChangeRequest]
            },
            ClientMembershipMutationError.CurrentMembershipMissing => new Dictionary<string, string[]>
            {
                ["currentMembership"] = [ClientResources.CurrentMembershipMissingForAction]
            },
            ClientMembershipMutationError.CurrentMembershipAlreadyPaid => new Dictionary<string, string[]>
            {
                ["currentMembership"] = [ClientResources.CurrentMembershipAlreadyPaid]
            },
            ClientMembershipMutationError.CorrectedPurchaseDateAfterRefund => new Dictionary<string, string[]>
            {
                ["purchaseDate"] = [ClientResources.CorrectedPurchaseDateAfterRefund]
            },
            ClientMembershipMutationError.PricingSelectionMissing => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Choose a catalog item or provide a manual sale amount."],
                ["manualSaleAmount"] = ["Choose a catalog item or provide a manual sale amount."]
            },
            ClientMembershipMutationError.ManualSaleAmountInvalid => new Dictionary<string, string[]>
            {
                ["manualSaleAmount"] = ["Manual sale amount must be a positive whole number of RUB within the supported range."]
            },
            ClientMembershipMutationError.ProfessionalOverrideNotAllowed => new Dictionary<string, string[]>
            {
                ["manualSaleAmount"] = ["Professional membership can only use its zero catalog price."]
            },
            ClientMembershipMutationError.ProfessionalPermissionDenied => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Only HeadCoach can assign Professional membership."]
            },
            ClientMembershipMutationError.CatalogItemMissing or
            ClientMembershipMutationError.CatalogItemBranchMismatch or
            ClientMembershipMutationError.CatalogItemUnavailable => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Selected membership catalog item is not available for this client."]
            },
            _ => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.MembershipChangeFailed]
            }
        };
    }

    private static Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult> MapRefundMutationError(
        ClientMembershipRefundMutationError error)
    {
        if (error == ClientMembershipRefundMutationError.ClientMissing)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.ValidationProblem(error switch
        {
            ClientMembershipRefundMutationError.SaleMissing => new Dictionary<string, string[]>
            {
                ["saleId"] = [ClientResources.SaleMustExist]
            },
            ClientMembershipRefundMutationError.RefundMissing => new Dictionary<string, string[]>
            {
                ["refundId"] = [ClientResources.RefundMustExist]
            },
            ClientMembershipRefundMutationError.RefundAmountExceedsGrossAmount => new Dictionary<string, string[]>
            {
                ["amount"] = [ClientResources.RefundAmountExceedsGrossAmount]
            },
            ClientMembershipRefundMutationError.RefundDateInFuture => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateInFuture]
            },
            ClientMembershipRefundMutationError.RefundDateBeforePurchaseDate => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateBeforePurchaseDate]
            },
            ClientMembershipRefundMutationError.RefundDateBeforeSaleCreatedDate => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateBeforeSaleCreatedDate]
            },
            ClientMembershipRefundMutationError.RefundAlreadyCanceled => new Dictionary<string, string[]>
            {
                ["refund"] = [ClientResources.RefundAlreadyCanceled]
            },
            _ => new Dictionary<string, string[]>
            {
                ["refund"] = [ClientResources.InvalidMembershipChangeRequest]
            }
        });
    }

    private static void ValidateNamePart(
        string? value,
        string key,
        string message,
        Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Length > 128)
        {
            errors[key] = [message];
        }
    }

    private static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
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

    private static string SerializeAuditState(Client client)
    {
        return JsonSerializer.Serialize(
            new ClientAuditState(
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                client.Phone,
                client.BranchId,
                client.BirthDate,
                client.Notes,
                client.Status.ToString(),
                client.Contacts
                    .Select(contact => new ClientContactAuditState(contact.Type, contact.FullName, contact.Phone))
                    .OrderBy(contact => contact.FullName, StringComparer.CurrentCulture)
                    .ThenBy(contact => contact.Type, StringComparer.CurrentCulture)
                    .ThenBy(contact => contact.Phone, StringComparer.CurrentCulture)
                    .ToArray(),
                client.Groups
                    .Select(clientGroup => clientGroup.GroupId)
                    .OrderBy(groupId => groupId)
                    .ToArray(),
                client.CreatedAt,
                client.UpdatedAt),
            AuditSerializerOptions);
    }


    private static AuditLogEntry BuildNoteAuditEntry(
        Guid actorId,
        Client client,
        string actorLogin,
        string transition)
    {
        return new AuditLogEntry(
            actorId,
            ClientAuditConstants.ClientNoteChangedAction,
            ClientAuditConstants.ClientEntityType,
            client.Id.ToString(),
            ClientAuditResources.ClientNoteChangedDescription(
                actorLogin,
                BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
            NewValueJson: JsonSerializer.Serialize(new { transition }, AuditSerializerOptions));
    }

    private static async Task TryWriteClientAuditAsync(
        IAuditLogService auditLogService,
        GymCrmDbContext dbContext,
        ILoggerFactory loggerFactory,
        Guid actorId,
        Guid clientId,
        AuditLogEntry entry,
        CancellationToken cancellationToken)
    {
        try
        {
            await auditLogService.WriteAsync(entry, cancellationToken);
        }
        catch (Exception exception)
        {
            foreach (var trackedAudit in dbContext.ChangeTracker.Entries<AuditLog>()
                         .Where(tracked => tracked.State == EntityState.Added))
            {
                trackedAudit.State = EntityState.Detached;
            }

            loggerFactory.CreateLogger("ClientAudit").LogError(
                exception,
                "Client audit write failed. ActionType={ActionType} ClientId={ClientId} ActorId={ActorId}",
                entry.ActionType,
                clientId,
                actorId);
        }
    }

    private static string? SerializeMembershipAuditState(ClientMembership? membership)
    {
        if (membership is null)
        {
            return null;
        }

        return JsonSerializer.Serialize(
            new ClientMembershipAuditState(
                membership.Id,
                membership.ClientId,
                membership.SaleId,
                membership.Sale.MembershipCatalogItemId,
                ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                membership.BehaviorKind.ToString(),
                membership.Sale.PricingMode.ToString(),
                membership.Sale.GrossAmount,
                ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
                membership.Sale.PurchaseDate,
                membership.Sale.PaymentDate,
                membership.IndividualValidTo,
                membership.IndividualValidFrom,
                membership.IndividualValidTo,
                membership.ProfessionalComment,
                membership.SingleVisitUsed,
                membership.Sale.CreatedByUserId,
                membership.Sale.CreatedAt,
                membership.ChangeReason.ToString(),
                membership.ChangedByUserId,
                membership.ValidFrom,
                membership.ValidTo,
                membership.CreatedAt),
            AuditSerializerOptions);
    }

    private static string SerializeSaleAuditState(ClientMembershipSaleSnapshotResult sale)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipSaleAuditState(
                sale.Id,
                sale.ClientId,
                sale.MembershipCatalogItemId,
                sale.MembershipName,
                sale.BehaviorKind.ToString(),
                sale.PricingMode.ToString(),
                sale.PurchaseDate,
                sale.PaymentDate,
                sale.GrossAmount,
                sale.CatalogPrice,
                sale.CreatedByUserId,
                sale.CreatedAt),
            AuditSerializerOptions);
    }

    private static string SerializeRefundAuditState(ClientMembershipRefundSnapshotResult refund)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipRefundAuditState(
                refund.Id,
                refund.SaleId,
                refund.ClientId,
                refund.Amount,
                refund.RefundDate,
                refund.Comment,
                refund.CreatedByUserId,
                refund.CreatedAt,
                refund.CanceledAt,
                refund.CanceledByUserId),
            AuditSerializerOptions);
    }

}
