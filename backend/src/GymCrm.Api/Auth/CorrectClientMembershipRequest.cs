using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class CorrectClientMembershipRequest
{
    public Guid? SaleId { get; init; }
    public Guid? ExpectedMembershipId { get; init; }
    public string? ValidFrom { get; init; }
    public string? ValidTo { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
