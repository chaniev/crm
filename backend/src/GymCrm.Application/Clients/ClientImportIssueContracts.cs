namespace GymCrm.Application.Clients;

public sealed record ClientImportIssue(int? Row, string? Field, string Code, string Message);
