namespace GymCrm.Api.Auth;

internal sealed record AttendanceClientResponse(
    Guid Id,
    string FullName,
    IReadOnlyList<ClientGroupSummaryResponse> Groups,
    ClientPhotoSummaryResponse? Photo,
    bool IsPresent,
    bool IsProfessional,
    string? ProfessionalComment,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasUnpaidCurrentMembership,
    bool HasActivePaidMembership);
