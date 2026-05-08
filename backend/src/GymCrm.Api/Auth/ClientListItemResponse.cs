namespace GymCrm.Api.Auth;

internal sealed record ClientListItemResponse(
    Guid Id,
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string FullName,
    string Phone,
    string Status,
    IReadOnlyList<Guid> GroupIds,
    IReadOnlyList<ClientGroupSummaryResponse> Groups,
    int ContactCount,
    ClientPhotoSummaryResponse? Photo,
    bool IsProfessional,
    string? ProfessionalComment,
    bool HasActivePaidMembership,
    bool HasUnpaidCurrentMembership,
    CurrentMembershipSummaryResponse? CurrentMembershipSummary,
    bool HasCurrentMembership,
    string MembershipState,
    DateOnly? LastVisitDate,
    DateTimeOffset UpdatedAt);
