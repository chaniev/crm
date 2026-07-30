namespace GymCrm.Api.Auth;

internal sealed record GroupListResponse(
    IReadOnlyList<GroupListItemResponse> Items,
    int TotalCount,
    int Skip,
    int Take);
