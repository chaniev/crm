using GymCrm.Domain.Clients;

namespace GymCrm.Application.Clients;

public sealed record ClientCreationData(string? LastName, string? FirstName, string? MiddleName,
    string Phone, Guid BranchId, DateOnly? BirthDate, string? Notes,
    IReadOnlyList<Guid> GroupIds, IReadOnlyList<ClientContact> Contacts, string? TelegramContactUsername = null);
