namespace GymCrm.Api.Auth;

internal sealed record UpsertClientRequest : ClientProfileRequest
{
    public Guid? BranchId { get; init; }
    public IReadOnlyList<Guid>? GroupIds { get; init; }
}
