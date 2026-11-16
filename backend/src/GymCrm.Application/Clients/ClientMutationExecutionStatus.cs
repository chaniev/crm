namespace GymCrm.Application.Clients;

public enum ClientMutationExecutionStatus
{
    Success,
    NotFound,
    CompletedWithoutVisibleClient,
    InvalidRequest,
    MissingIdempotencyKey,
    IdempotencyConflict,
    InProgress,
    InProgressAfterReservationCollision,
    Rejected,
    Failed
}
