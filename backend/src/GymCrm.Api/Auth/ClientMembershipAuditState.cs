namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipAuditState(
    Guid Id,
    Guid ClientId,
    Guid SaleId,
    Guid MembershipCatalogItemId,
    string MembershipName,
    string BehaviorKind,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    DateOnly? IndividualValidFrom,
    DateOnly? IndividualValidTo,
    string? ProfessionalComment,
    decimal PaymentAmount,
    bool IsPaid,
    bool SingleVisitUsed,
    Guid? PaidByUserId,
    DateTimeOffset? PaidAt,
    string ChangeReason,
    Guid ChangedByUserId,
    DateTimeOffset ValidFrom,
    DateTimeOffset? ValidTo,
    DateTimeOffset CreatedAt);
