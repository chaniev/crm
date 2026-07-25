using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public interface IAdministratorAttendanceGroupGrantService
{
    Task<AdministratorAttendanceGroupGrantServiceResult> GetAsync(
        Guid administratorId,
        User currentUser,
        CancellationToken cancellationToken);

    Task<AdministratorAttendanceGroupGrantServiceResult> UpdateAsync(
        Guid administratorId,
        User currentUser,
        IReadOnlyCollection<Guid> groupIds,
        IReadOnlyCollection<Guid> expectedGroupIds,
        CancellationToken cancellationToken);
}

public sealed record AdministratorAttendanceGroupGrantServiceResult(
    AdministratorAttendanceGroupGrantServiceError? Error,
    AdministratorAttendanceGroupsResponse? Response,
    Dictionary<string, string[]>? ValidationErrors)
{
    public static AdministratorAttendanceGroupGrantServiceResult Success(AdministratorAttendanceGroupsResponse response) =>
        new(null, response, null);

    public static AdministratorAttendanceGroupGrantServiceResult Failure(AdministratorAttendanceGroupGrantServiceError error) =>
        new(error, null, null);

    public static AdministratorAttendanceGroupGrantServiceResult Validation(Dictionary<string, string[]> errors) =>
        new(AdministratorAttendanceGroupGrantServiceError.Validation, null, errors);
}

public enum AdministratorAttendanceGroupGrantServiceError
{
    NotFound = 1,
    Forbidden = 2,
    Validation = 3,
    ConcurrencyConflict = 4,
    BranchForbidden = 5,
    InactiveResource = 6
}

public sealed record AdministratorAttendanceGroupsResponse(
    AdministratorAttendanceTargetResponse Target,
    AdministratorAttendanceBranchResponse? Branch,
    IReadOnlyList<Guid> GrantedGroupIds,
    int StoredGrantCount,
    IReadOnlyList<AdministratorAttendanceGroupOptionResponse> Groups,
    IReadOnlyList<AdministratorAttendanceUnavailableGrantResponse> UnavailableStoredGrants);

public sealed record AdministratorAttendanceTargetResponse(
    Guid Id,
    string FullName,
    string Login,
    bool IsActive);

public sealed record AdministratorAttendanceBranchResponse(
    Guid Id,
    string Name,
    bool IsArchived);

public sealed record AdministratorAttendanceGroupOptionResponse(
    Guid Id,
    string Name,
    string TrainingStartTime,
    int DurationMinutes,
    IReadOnlyList<int> Weekdays,
    bool IsActive,
    bool IsGranted,
    bool CanGrant,
    bool CanRevoke,
    string? DisabledReason);

public sealed record AdministratorAttendanceUnavailableGrantResponse(
    Guid GroupId,
    Guid BranchId,
    bool IsGranted,
    bool CanGrant,
    bool CanRevoke,
    string DisabledReason);
