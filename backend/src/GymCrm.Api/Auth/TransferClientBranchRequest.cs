namespace GymCrm.Api.Auth;

internal sealed record TransferClientBranchRequest(
    Guid? BranchId,
    Guid? GroupId,
    IReadOnlyList<Guid>? GroupIds,
    Guid? TargetBranchId = null,
    IReadOnlyList<Guid>? TargetGroupIds = null,
    Guid? MembershipCatalogItemId = null,
    string? ValidFrom = null,
    string? ValidTo = null,
    string? PaymentStatus = null,
    string? PaymentDate = null,
    string? ProfessionalComment = null);
