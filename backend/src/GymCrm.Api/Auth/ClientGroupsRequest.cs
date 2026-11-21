namespace GymCrm.Api.Auth;

internal sealed record ClientGroupsRequest(IReadOnlyList<Guid>? GroupIds);
