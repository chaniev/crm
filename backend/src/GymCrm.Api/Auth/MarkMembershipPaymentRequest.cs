using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class MarkMembershipPaymentRequest
{
    public Guid? SaleId { get; init; }
    public Guid? ExpectedMembershipId { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
