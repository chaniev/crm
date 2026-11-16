namespace GymCrm.Application.Clients;

public interface IClientMembershipExecutionWorkflow
{
    Task<ClientMutationExecutionResult<ClientMembershipMutationError>> ExecuteAsync(
        ClientMembershipExecutionOperation operation, CancellationToken cancellationToken);

    Task<bool> IsCompletedTransferReplayAsync(
        Guid clientId, Guid actorId, string? idempotencyKey, object payload, CancellationToken cancellationToken);
}
