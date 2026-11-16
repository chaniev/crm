using GymCrm.Application.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Application.Clients;

public sealed record ClientMembershipExecutionOperation(
    Guid ClientId,
    User Actor,
    string? IdempotencyKey,
    Func<object> CreateIdempotencyPayload,
    string ActionType,
    Func<Client, Dictionary<string, string[]>> ValidateRequest,
    Func<User, Task<ClientMembershipMutationResult>> ExecuteAsync,
    Func<User, Client, Client, ClientMembershipMutationResult, IReadOnlyList<AuditLogEntry>> CreateAuditEntries,
    IReadOnlyCollection<Guid> LockGroupIds,
    IReadOnlyCollection<Guid> LockBranchIds,
    Func<Task<Dictionary<string, string[]>>>? ValidateLockedAsync = null);
