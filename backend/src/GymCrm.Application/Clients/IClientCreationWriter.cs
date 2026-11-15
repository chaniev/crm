using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Application.Clients;

public interface IClientCreationWriter
{
    Task<Client> WriteAsync(ClientCreationData data, User actor, CancellationToken cancellationToken);
}
