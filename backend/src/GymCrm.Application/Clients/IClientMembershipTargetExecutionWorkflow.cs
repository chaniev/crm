namespace GymCrm.Application.Clients;

public interface IClientMembershipTargetExecutionWorkflow
{
    Task<ClientMutationExecutionResult<ClientMembershipTargetTransferResult>> ExecuteAsync(
        ClientMembershipTargetExecutionOperation operation, CancellationToken cancellationToken);

    Task CleanupFailedResultAsync(Guid? reservationId);
}
