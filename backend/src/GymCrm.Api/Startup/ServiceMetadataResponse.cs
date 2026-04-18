using System.Text.Json.Serialization;

namespace GymCrm.Api.Startup;

internal sealed record ServiceMetadataResponse(
    [property: JsonPropertyName("service")] string Service,
    [property: JsonPropertyName("environment")] string Environment,
    [property: JsonPropertyName("endpoints")] ServiceMetadataResponse.EndpointCollectionResponse Endpoints)
{
    internal sealed record EndpointCollectionResponse(
        [property: JsonPropertyName("live")] string Live,
        [property: JsonPropertyName("ready")] string Ready);
}
