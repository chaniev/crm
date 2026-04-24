namespace GymCrm.Application.Bot;

public interface IBotApiService
{
    Task<BotApiResult<BotUserContext>> ResolveUserContextAsync(
        BotIdentity identity,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotMenuResponse>> GetMenuAsync(
        BotIdentity identity,
        CancellationToken cancellationToken);

    Task<BotApiResult<IReadOnlyList<BotAttendanceGroup>>> ListAttendanceGroupsAsync(
        BotIdentity identity,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotAttendanceRoster>> GetAttendanceRosterAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotAttendanceSaveResponse>> SaveAttendanceAsync(
        BotIdentity identity,
        Guid groupId,
        DateOnly trainingDate,
        IReadOnlyList<BotAttendanceMarkInput> marks,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotClientSearchResponse>> SearchClientsAsync(
        BotIdentity identity,
        string? query,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotClientCard>> GetClientCardAsync(
        BotIdentity identity,
        Guid clientId,
        CancellationToken cancellationToken);

    Task<BotApiResult<IReadOnlyList<BotExpiringMembershipListItem>>> ListExpiringMembershipsAsync(
        BotIdentity identity,
        CancellationToken cancellationToken);

    Task<BotApiResult<IReadOnlyList<BotUnpaidMembershipListItem>>> ListUnpaidMembershipsAsync(
        BotIdentity identity,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotMembershipPaymentResponse>> MarkMembershipPaymentAsync(
        BotIdentity identity,
        Guid clientId,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken);

    Task<BotApiResult<BotAccessDeniedAuditResponse>> WriteAccessDeniedAuditAsync(
        BotIdentity identity,
        BotAccessDeniedAuditRequest request,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken);
}
