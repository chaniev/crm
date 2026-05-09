namespace GymCrm.Api.Auth;

internal sealed record ClientAuditState(
    Guid Id,
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string Phone,
    Guid BranchId,
    string? Notes,
    bool IsProfessional,
    string? ProfessionalComment,
    string Status,
    IReadOnlyList<ClientContactAuditState> Contacts,
    IReadOnlyList<Guid> GroupIds,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
