namespace GymCrm.Api.Auth;

internal sealed record HallResponse(
    Guid Id,
    Guid BranchId,
    string BranchName,
    string Name,
    string? Description,
    bool IsArchived,
    int GroupCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
