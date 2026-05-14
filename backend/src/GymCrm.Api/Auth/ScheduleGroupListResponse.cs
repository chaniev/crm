namespace GymCrm.Api.Auth;

internal sealed record ScheduleGroupListResponse(
    IReadOnlyList<GroupListItemResponse> Items,
    int TotalCount,
    int Skip,
    int Take);
