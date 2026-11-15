namespace GymCrm.Application.Clients;

public sealed record ClientImportResult(Guid OperationId, int CreatedCount, string? Code = null, IReadOnlyList<ClientImportIssue>? Issues = null);
