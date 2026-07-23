using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class CorrectClientMembershipRequest
{
    public string? PurchaseDate { get; init; }
    public string? ExpirationDate { get; init; }
    public bool? IsPaid { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
