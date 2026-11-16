using GymCrm.Application.Clients;

namespace GymCrm.Infrastructure.Clients;

internal readonly record struct ClientMembershipRefundReservation(
    bool IsReplay,
    ClientMutationExecutionStatus? Failure,
    Guid? RecordId = null);
