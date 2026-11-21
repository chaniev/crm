namespace GymCrm.Api.Auth;

internal sealed record ClientAuditState(
    Guid Id,
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string Phone,
    string? TelegramContactUsername,
    Guid BranchId,
    DateOnly? BirthDate,
    string? Notes,
    string Status,
    IReadOnlyList<ClientContactAuditState> Contacts,
    IReadOnlyList<Guid> GroupIds,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
