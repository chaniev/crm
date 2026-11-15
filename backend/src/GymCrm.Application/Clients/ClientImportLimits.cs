namespace GymCrm.Application.Clients;

public static class ClientImportLimits
{
    public const int FileBytes = 512 * 1024;
    public const int BodyBytes = 768 * 1024;
    public const int ExpandedBytes = 8 * 1024 * 1024;
    public const int Rows = 1000;
}
