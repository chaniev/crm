namespace GymCrm.Api.Auth;

internal sealed record AttendanceTodayTrainerResponse(
    Guid TrainerId,
    string FullName,
    string Kind);
