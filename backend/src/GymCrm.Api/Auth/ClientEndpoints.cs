namespace GymCrm.Api.Auth;

internal static class ClientEndpoints
{
    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients");

        group.MapClientQueryEndpoints();
        group.MapClientLifecycleEndpoints();
        group.MapClientImportEndpoints();
        group.MapClientMembershipEndpoints();

        return endpoints;
    }
}
