namespace GymCrm.Api.Auth;

internal sealed record AttendanceClientResponse(
    Guid Id,
    string FullName,
    IReadOnlyList<ClientGroupSummaryResponse> Groups,
    ClientPhotoSummaryResponse? Photo,
    string State,
    bool IsProfessional,
    string? ProfessionalComment,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasUnpaidCurrentMembership,
    bool HasActivePaidMembership);
