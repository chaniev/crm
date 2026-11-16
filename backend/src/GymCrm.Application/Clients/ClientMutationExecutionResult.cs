using GymCrm.Domain.Clients;

namespace GymCrm.Application.Clients;

public sealed record ClientMutationExecutionResult<TFailure>(
    ClientMutationExecutionStatus Status,
    Client? Client = null,
    Dictionary<string, string[]>? ValidationErrors = null,
    TFailure Failure = default!,
    bool IsReplay = false,
    Guid? ReservationId = null);
