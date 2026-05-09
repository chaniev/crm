namespace GymCrm.Api.Auth;

internal sealed record BranchResponse(
    Guid Id,
    string Name,
    string? Address,
    string? Description,
    bool IsArchived,
    int HallCount,
    int GroupCount,
    int ClientCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
