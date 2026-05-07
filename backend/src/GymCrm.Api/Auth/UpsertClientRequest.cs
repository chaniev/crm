namespace GymCrm.Api.Auth;

internal sealed record UpsertClientRequest(
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string? Phone,
    string? Notes,
    IReadOnlyList<UpsertClientContactRequest>? Contacts,
    IReadOnlyList<Guid>? GroupIds);
