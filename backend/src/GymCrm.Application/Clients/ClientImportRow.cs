namespace GymCrm.Application.Clients;

public sealed record ClientImportRow(int Row, IReadOnlyList<string> Cells);
