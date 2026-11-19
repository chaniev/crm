namespace GymCrm.Api.Auth;

internal sealed record GroupCreateOptionsResponse(IReadOnlyList<GroupCreateBranchOptionResponse> Branches, IReadOnlyList<GroupCreateHallOptionResponse> Halls);
