using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class PurchaseClientMembershipRequest
{
    public Guid? MembershipCatalogItemId { get; init; }
    public string? ValidFrom { get; init; }
    public string? ValidTo { get; init; }
    public string? PaymentStatus { get; init; }
    public string? PaymentDate { get; init; }
    public string? ProfessionalComment { get; init; }
    public decimal? ManualSaleAmount { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
