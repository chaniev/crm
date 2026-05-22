using System.Text.Json.Serialization;

namespace GymCrm.Api.Startup;

internal sealed record AppConfigResponse(
    [property: JsonPropertyName("clubName")] string ClubName);
