namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupsResponse(
    IReadOnlyList<AttendanceGroupResponse> Groups,
    DateOnly Today,
    DateOnly? MinTrainingDate,
    DateOnly MaxTrainingDate);
