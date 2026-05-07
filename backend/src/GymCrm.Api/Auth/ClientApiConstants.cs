using GymCrm.Domain.Clients;

namespace GymCrm.Api.Auth;

internal static class ClientApiConstants
{
    public const int DefaultPage = 1;
    public const int DefaultTake = 20;
    public const int MaxTake = 100;
    public const int NotesMaxLength = Client.NotesMaxLength;
}
