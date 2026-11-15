namespace GymCrm.Application.Clients;

public interface IClientXlsxReader
{
    Task<ClientXlsxReadResult> ReadAsync(Stream stream, CancellationToken cancellationToken = default);
}
