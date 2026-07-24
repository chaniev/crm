namespace GymCrm.Api.Auth;

internal sealed record UserListResponse(
    IReadOnlyList<UserResponse> Items,
    IReadOnlyList<string> CreateRoleOptions);
