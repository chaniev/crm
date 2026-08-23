using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class TransferClientBranchRequest
{
    public Guid? TargetBranchId { get; init; }
    public IReadOnlyList<Guid>? TargetGroupIds { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
