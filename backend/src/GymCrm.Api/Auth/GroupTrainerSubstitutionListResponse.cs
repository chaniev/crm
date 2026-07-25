namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerSubstitutionListResponse(
    IReadOnlyList<GroupTrainerSubstitutionResponse> Current,
    GroupTrainerSubstitutionHistoryResponse History,
    bool CanCreate,
    GroupTrainerSubstitutionCreateUnavailableReasonResponse? CreateUnavailableReason);
