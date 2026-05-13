namespace GymCrm.Api.Auth;

internal sealed record GroupTypeSummaryResponse(
    Guid Id,
    string Name,
    string SystemIdentifier);
