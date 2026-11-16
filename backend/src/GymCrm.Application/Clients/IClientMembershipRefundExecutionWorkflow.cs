namespace GymCrm.Application.Clients;

public interface IClientMembershipRefundExecutionWorkflow
{
    Task<ClientMutationExecutionResult<ClientMembershipRefundMutationError>> ExecuteAsync(
        ClientMembershipRefundExecutionOperation operation, CancellationToken cancellationToken);

    Task CleanupFailedResultAsync(Guid? reservationId);
}
