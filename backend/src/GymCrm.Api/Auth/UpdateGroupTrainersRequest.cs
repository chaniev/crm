namespace GymCrm.Api.Auth;

internal sealed record UpdateGroupTrainersRequest(IReadOnlyList<Guid>? TrainerIds);
