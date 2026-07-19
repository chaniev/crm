namespace GymCrm.Api.Auth;

internal sealed record RenewClientMembershipRequest(
    Guid? MembershipCatalogItemId,
    string? PaymentStatus,
    string? PaymentDate,
    string? ProfessionalComment);
