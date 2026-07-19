using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed record MembershipCatalogItemResponse(Guid Id, Guid? BranchId, string Name, decimal Price,
    string BehaviorKind, DateOnly AvailableFrom, DateOnly? AvailableTo, bool IsSystemOwned);

internal sealed record CreateMembershipCatalogItemRequest(Guid BranchId, string Name, decimal Price,
    string BehaviorKind, DateOnly AvailableFrom, DateOnly? AvailableTo);

internal sealed record UpdateMembershipCatalogItemRequest(string Name, DateOnly AvailableFrom, DateOnly? AvailableTo)
{
    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
