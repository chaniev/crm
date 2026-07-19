namespace GymCrm.Api.Auth;

internal sealed record PurchaseClientMembershipRequest(
    Guid? MembershipCatalogItemId,
    string? ValidFrom,
    string? ValidTo,
    string? PaymentStatus,
    string? PaymentDate,
    string? ProfessionalComment);
