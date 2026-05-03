namespace GymCrm.Api.Auth;

internal sealed record UpsertClientRequest(
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string? Phone,
    IReadOnlyList<UpsertClientContactRequest>? Contacts,
    IReadOnlyList<Guid>? GroupIds);
