namespace GymCrm.Application.Clients;

public sealed record ClientXlsxReadResult(IReadOnlyList<ClientImportRow> Rows, IReadOnlyList<ClientImportIssue> Issues, bool LimitExceeded = false);
