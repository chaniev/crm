using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Application.Clients;

public interface IClientMembershipService
{
    Task<ClientMembershipDetailsResult?> GetAsync(
        Guid clientId,
        CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> PurchaseAsync(
        Guid clientId,
        CreateClientMembershipPurchaseCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> RenewAsync(
        Guid clientId,
        RenewClientMembershipCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipCommentMutationResult> UpdateCommentAsync(
        Guid clientId, Guid saleId, UpdateClientMembershipCommentCommand command, CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> CorrectAsync(
        Guid clientId,
        CorrectClientMembershipCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipRefundMutationResult> RegisterRefundAsync(
        Guid clientId,
        RegisterClientMembershipRefundCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipRefundMutationResult> CancelRefundAsync(
        Guid clientId,
        CancelClientMembershipRefundCommand command,
        CancellationToken cancellationToken);

    Task<SingleVisitWriteOffResult> WriteOffSingleVisitAsync(
        Guid clientId,
        WriteOffSingleVisitCommand command,
        CancellationToken cancellationToken);

    Task<SingleVisitRestoreResult> RestoreSingleVisitAsync(
        Guid clientId,
        RestoreSingleVisitCommand command,
        CancellationToken cancellationToken);
}

public sealed record UpdateClientMembershipCommentCommand(Guid ChangedByUserId, string? Comment);

public readonly record struct ClientMembershipCommentMutationResult(
    bool Found, string? Transition, ClientMembershipDetailsResult? Details)
{
    public static ClientMembershipCommentMutationResult Missing() => new(false, null, null);
    public static ClientMembershipCommentMutationResult Success(string? transition, ClientMembershipDetailsResult details) =>
        new(true, transition, details);
}

public sealed record RestoreSingleVisitCommand(
    Guid ChangedByUserId,
    Guid ExpectedSaleId,
    Guid ExpectedWriteOffMembershipId);

public sealed record CreateClientMembershipPurchaseCommand(
    Guid ChangedByUserId,
    Guid? MembershipCatalogItemId,
    DateOnly? ValidFrom,
    DateOnly? ValidTo,
    DateOnly PaymentDate,
    string? ProfessionalComment,
    decimal? ManualSaleAmount = null);

public sealed record RenewClientMembershipCommand(
    Guid ChangedByUserId,
    Guid? MembershipCatalogItemId,
    DateOnly PaymentDate,
    string? ProfessionalComment,
    decimal? ManualSaleAmount = null);

public sealed record CorrectClientMembershipCommand(
    Guid ChangedByUserId,
    Guid SaleId,
    Guid ExpectedMembershipId,
    DateOnly? ValidFrom,
    DateOnly? ValidTo,
    DateOnly PaymentDate);

public sealed record RegisterClientMembershipRefundCommand(
    Guid ChangedByUserId,
    Guid SaleId,
    DateOnly RefundDate,
    decimal Amount,
    string? Comment);

public sealed record CancelClientMembershipRefundCommand(
    Guid ChangedByUserId,
    Guid RefundId);

public sealed record WriteOffSingleVisitCommand(
    Guid ChangedByUserId,
    DateOnly TrainingDate);

public enum ClientMembershipMutationError
{
    None = 0,
    ClientMissing = 1,
    InvalidRequest = 2,
    CurrentMembershipMissing = 3,
    CurrentMembershipAlreadyPaid = 4,
    CorrectedPurchaseDateAfterRefund = 6,
    CatalogItemMissing = 7,
    CatalogItemBranchMismatch = 8,
    CatalogItemUnavailable = 9,
    MembershipValidityInvalid = 10,
    ActiveMembershipExists = 11,
    RenewalNotAllowed = 12,
    MembershipOverlap = 13,
    PricingSelectionMissing = 14,
    ManualSaleAmountInvalid = 15,
    ProfessionalOverrideNotAllowed = 16,
    ProfessionalPermissionDenied = 17,
    MembershipTargetMissing = 18,
    MembershipTargetConflict = 19
}

public enum ClientMembershipRefundMutationError
{
    None = 0,
    ClientMissing = 1,
    SaleMissing = 2,
    RefundMissing = 3,
    InvalidRequest = 4,
    RefundAmountExceedsGrossAmount = 5,
    RefundDateInFuture = 6,
    RefundDateBeforePurchaseDate = 7,
    RefundDateBeforeSaleCreatedDate = 8,
    RefundAlreadyCanceled = 9
}

public enum SingleVisitWriteOffStatus
{
    Applied = 0,
    InvalidRequest = 1,
    ClientMissing = 2,
    CurrentMembershipMissing = 3,
    MembershipNotSingleVisit = 4,
    SingleVisitAlreadyUsed = 5,
    MembershipPurchasedAfterTrainingDate = 6,
    ProfessionalPrivilegeActive = 7
}

public enum SingleVisitRestoreStatus
{
    Applied = 0,
    InvalidRequest = 1,
    Conflict = 2
}

public sealed record ClientMembershipDetailsResult(
    Guid ClientId,
    ClientMembershipSnapshotResult? CurrentMembership,
    IReadOnlyList<ClientMembershipSnapshotResult> MembershipHistory);

public sealed record ClientMembershipSnapshotResult(
    Guid Id,
    Guid? MembershipCatalogItemId,
    string MembershipName,
    MembershipBehaviorKind BehaviorKind,
    ClientMembershipSalePricingMode PricingMode,
    decimal GrossAmount,
    decimal? CatalogPrice,
    DateOnly PurchaseDate,
    DateOnly PaymentDate,
    DateOnly? ExpirationDate,
    DateOnly? IndividualValidFrom,
    DateOnly? IndividualValidTo,
    string? ProfessionalComment,
    bool SingleVisitUsed,
    Guid PaymentRecordedByUserId,
    DateTimeOffset PaymentRecordedAt,
    DateTimeOffset ValidFrom,
    DateTimeOffset? ValidTo,
    ClientMembershipChangeReason ChangeReason,
    Guid ChangedByUserId,
    DateTimeOffset CreatedAt,
    Guid SaleId,
    string? Comment,
    string? CommentLastChangedByName,
    DateTimeOffset? CommentLastChangedAt,
    ClientMembershipFinancialSummaryResult FinancialSummary,
    IReadOnlyList<ClientMembershipRefundSnapshotResult> Refunds);

public sealed record ClientMembershipFinancialSummaryResult(
    decimal GrossAmount,
    decimal RefundedAmount,
    decimal NetAmount,
    ClientMembershipRefundStatus RefundStatus,
    DateOnly? LastRefundDate);

public sealed record ClientMembershipRefundSnapshotResult(
    Guid Id,
    Guid SaleId,
    Guid ClientId,
    decimal Amount,
    DateOnly RefundDate,
    string? Comment,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CanceledAt,
    Guid? CanceledByUserId);

public sealed record ClientMembershipSaleSnapshotResult(
    Guid Id,
    Guid ClientId,
    Guid? MembershipCatalogItemId,
    string MembershipName,
    MembershipBehaviorKind BehaviorKind,
    ClientMembershipSalePricingMode PricingMode,
    DateOnly PurchaseDate,
    DateOnly PaymentDate,
    decimal GrossAmount,
    decimal? CatalogPrice,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt);

public sealed record ClientMembershipSaleAuditResult(
    ClientMembershipSaleSnapshotResult OldSale,
    ClientMembershipSaleSnapshotResult NewSale);

public readonly record struct ClientMembershipMutationResult(
    ClientMembershipMutationError Error,
    ClientMembershipDetailsResult? Details,
    ClientMembershipSaleAuditResult? SaleAudit)
{
    public bool Succeeded => Error == ClientMembershipMutationError.None;

    public static ClientMembershipMutationResult Success(ClientMembershipDetailsResult details) =>
        new(ClientMembershipMutationError.None, details, null);

    public static ClientMembershipMutationResult Success(
        ClientMembershipDetailsResult details,
        ClientMembershipSaleAuditResult? saleAudit) =>
        new(ClientMembershipMutationError.None, details, saleAudit);

    public static ClientMembershipMutationResult Failure(ClientMembershipMutationError error) =>
        new(error, null, null);
}

public readonly record struct ClientMembershipRefundMutationResult(
    ClientMembershipRefundMutationError Error,
    ClientMembershipDetailsResult? Details,
    ClientMembershipRefundSnapshotResult? Refund,
    ClientMembershipRefundSnapshotResult? PreviousRefund)
{
    public bool Succeeded => Error == ClientMembershipRefundMutationError.None;

    public static ClientMembershipRefundMutationResult Success(
        ClientMembershipDetailsResult details,
        ClientMembershipRefundSnapshotResult refund) =>
        new(ClientMembershipRefundMutationError.None, details, refund, null);

    public static ClientMembershipRefundMutationResult Success(
        ClientMembershipDetailsResult details,
        ClientMembershipRefundSnapshotResult refund,
        ClientMembershipRefundSnapshotResult previousRefund) =>
        new(ClientMembershipRefundMutationError.None, details, refund, previousRefund);

    public static ClientMembershipRefundMutationResult Failure(ClientMembershipRefundMutationError error) =>
        new(error, null, null, null);
}

public readonly record struct SingleVisitWriteOffResult(
    SingleVisitWriteOffStatus Status,
    ClientMembershipSnapshotResult? PreviousMembership,
    ClientMembershipSnapshotResult? CurrentMembership)
{
    public bool Applied => Status == SingleVisitWriteOffStatus.Applied;

    public static SingleVisitWriteOffResult Success(
        ClientMembershipSnapshotResult previousMembership,
        ClientMembershipSnapshotResult currentMembership) =>
        new(SingleVisitWriteOffStatus.Applied, previousMembership, currentMembership);

    public static SingleVisitWriteOffResult Skip(SingleVisitWriteOffStatus status) =>
        new(status, null, null);
}

public readonly record struct SingleVisitRestoreResult(
    SingleVisitRestoreStatus Status,
    ClientMembershipSnapshotResult? PreviousMembership,
    ClientMembershipSnapshotResult? CurrentMembership)
{
    public bool Applied => Status == SingleVisitRestoreStatus.Applied;

    public static SingleVisitRestoreResult Success(
        ClientMembershipSnapshotResult previousMembership,
        ClientMembershipSnapshotResult currentMembership) =>
        new(SingleVisitRestoreStatus.Applied, previousMembership, currentMembership);

    public static SingleVisitRestoreResult Failure(SingleVisitRestoreStatus status) =>
        new(status, null, null);
}
