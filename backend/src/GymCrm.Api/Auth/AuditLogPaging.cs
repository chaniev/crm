namespace GymCrm.Api.Auth;

internal sealed record AuditLogPaging(int Skip, int Take, int Page, int PageSize);
