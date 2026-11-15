namespace GymCrm.Application.Clients;

public interface IClientImportService
{
    Task<ClientImportResult> ImportAsync(Guid actorId, Guid branchId, string groupName, Guid operationId, Stream file, CancellationToken cancellationToken);
}
