namespace GymCrm.Application.Clients;

public sealed record ClientImportMappingResult(IReadOnlyList<ClientImportMappedRow> Rows, IReadOnlyList<ClientImportIssue> Issues);
