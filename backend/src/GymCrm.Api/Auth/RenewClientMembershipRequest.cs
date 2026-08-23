using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class RenewClientMembershipRequest
{
    public Guid? MembershipCatalogItemId { get; init; }
    public string? PaymentStatus { get; init; }
    public bool? IsPaid { get; init; }
    public string? PaymentDate { get; init; }
    public Guid? SaleId { get; init; }
    public Guid? ExpectedMembershipId { get; init; }
    public IReadOnlyList<Guid>? TargetGroupIds { get; init; }
    public string? ProfessionalComment { get; init; }
    public decimal? ManualSaleAmount { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
