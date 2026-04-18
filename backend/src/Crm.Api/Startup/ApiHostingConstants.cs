namespace Crm.Api.Startup;

internal static class ApiHostingConstants
{
    public const string RootPath = "/";
    public const string ServiceName = "crm-backend";
    public const string SelfHealthCheckName = "self";
    public const string SelfHealthCheckDescription = "API is running.";
    public const string LiveHealthTag = "live";
    public const string ReadyHealthTag = "ready";
    public const string LiveHealthPath = "/health/live";
    public const string ReadyHealthPath = "/health/ready";
}
