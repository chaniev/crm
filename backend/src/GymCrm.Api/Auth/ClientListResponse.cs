namespace GymCrm.Api.Auth;

internal sealed record ClientListResponse(
    IReadOnlyList<ClientListItemResponse> Items,
    int TotalCount,
    int Skip,
    int Take,
    int Page,
    int PageSize,
    bool HasNextPage,
    int ActiveCount,
    int ArchivedCount);
