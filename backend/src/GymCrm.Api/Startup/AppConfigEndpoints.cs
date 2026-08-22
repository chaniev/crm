using Microsoft.Extensions.Options;

namespace GymCrm.Api.Startup;

internal static class AppConfigEndpoints
{
    public static IEndpointRouteBuilder MapAppConfigEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints
            .MapGet(ApiHostingConstants.ConfigPath, GetAppConfig)
            .AllowAnonymous();

        return endpoints;
    }

    private static IResult GetAppConfig(IOptions<BrandingOptions> options)
    {
        var brandingOptions = options.Value;

        return Results.Ok(new AppConfigResponse(
            brandingOptions.ResolveClubName(),
            brandingOptions.ResolveThemeId(),
            brandingOptions.ResolveAuthBackgroundImageId()));
    }
}
