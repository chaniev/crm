using GymCrm.Application.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Application.Clients;

public sealed record ClientMembershipRefundExecutionOperation(
    Guid ClientId,
    User Actor,
    string? IdempotencyKey,
    Func<object> CreateIdempotencyPayload,
    string ActionType,
    Func<Dictionary<string, string[]>>? ValidateRequest,
    Func<User, Task<ClientMembershipRefundMutationResult>> ExecuteAsync,
    Func<User, Client, ClientMembershipRefundMutationResult, AuditLogEntry> CreateAuditEntry,
    Guid? RequestedSaleId);
