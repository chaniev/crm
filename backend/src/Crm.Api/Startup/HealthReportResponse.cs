using System.Text.Json.Serialization;

namespace Crm.Api.Startup;

internal sealed record HealthReportResponse(
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("totalDuration")] string TotalDuration,
    [property: JsonPropertyName("timestamp")] DateTimeOffset Timestamp,
    [property: JsonPropertyName("checks")] IReadOnlyDictionary<string, HealthReportResponse.HealthCheckEntryResponse> Checks)
{
    internal sealed record HealthCheckEntryResponse(
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("duration")] string Duration);
}
