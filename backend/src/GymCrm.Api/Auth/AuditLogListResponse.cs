namespace GymCrm.Api.Auth;

internal sealed record AuditLogListResponse(
    IReadOnlyList<AuditLogListItemResponse> Items,
    int TotalCount,
    int Skip,
    int Take,
    int Page,
    int PageSize,
    bool HasNextPage);
