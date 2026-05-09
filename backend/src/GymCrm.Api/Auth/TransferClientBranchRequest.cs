namespace GymCrm.Api.Auth;

internal sealed record TransferClientBranchRequest(
    Guid? BranchId,
    Guid? GroupId);
