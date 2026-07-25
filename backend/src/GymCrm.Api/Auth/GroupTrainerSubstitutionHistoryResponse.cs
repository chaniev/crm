namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerSubstitutionHistoryResponse(
    IReadOnlyList<GroupTrainerSubstitutionResponse> Items,
    int TotalCount,
    int Skip,
    int Take);
