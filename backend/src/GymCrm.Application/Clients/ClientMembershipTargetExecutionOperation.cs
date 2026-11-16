using GymCrm.Application.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Application.Clients;

public sealed record ClientMembershipTargetExecutionOperation(
    Guid ClientId,
    User Actor,
    string? IdempotencyKey,
    Func<object> CreateIdempotencyPayload,
    string ActionType,
    Func<User, Task<ClientMembershipTargetTransferResult>> ExecuteAsync,
    Func<User, Client, Client, AuditLogEntry> CreateAuditEntry,
    IReadOnlyCollection<Guid> LockGroupIds);
