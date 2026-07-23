using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class MarkMembershipPaymentRequest
{
    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
