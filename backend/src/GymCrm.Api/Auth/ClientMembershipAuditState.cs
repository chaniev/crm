namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipAuditState(
    Guid Id,
    Guid ClientId,
    Guid SaleId,
    Guid? MembershipCatalogItemId,
    string MembershipName,
    string BehaviorKind,
    string PricingMode,
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
    string ChangeReason,
    Guid ChangedByUserId,
    DateTimeOffset ValidFrom,
    DateTimeOffset? ValidTo,
    DateTimeOffset CreatedAt,
    IReadOnlyList<ClientMembershipTargetAuditState> TargetGroups);

internal sealed record ClientMembershipTargetAuditState(
    Guid GroupId,
    string GroupName,
    Guid BranchId,
    string BranchName,
    int Position,
    bool IsActive);
