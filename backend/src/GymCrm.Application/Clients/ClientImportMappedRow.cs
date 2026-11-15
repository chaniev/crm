namespace GymCrm.Application.Clients;

public sealed record ClientImportMappedRow(int Row, string LastName, string FirstName, string? MiddleName, string Phone, DateOnly? BirthDate, string? Notes);
