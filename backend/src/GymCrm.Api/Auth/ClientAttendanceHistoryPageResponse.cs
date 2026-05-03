namespace GymCrm.Api.Auth;

internal sealed record ClientAttendanceHistoryPageResponse(
    IReadOnlyList<ClientAttendanceHistoryEntryResponse> Items,
    int Skip,
    int Take,
    int TotalCount,
    bool HasMore);
