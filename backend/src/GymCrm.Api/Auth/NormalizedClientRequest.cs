namespace GymCrm.Api.Auth;

internal sealed record NormalizedClientRequest(
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string Phone,
    string? Notes,
    IReadOnlyList<UpsertClientContactRequest>? RawContacts,
    IReadOnlyList<NormalizedClientContactRequest> Contacts,
    IReadOnlyList<Guid>? RawGroupIds,
    IReadOnlyList<Guid> GroupIds);
