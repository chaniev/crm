using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal sealed class TransferClientBranchRequest
{
    private Guid? membershipCatalogItemId;
    private string? validFrom;
    private string? validTo;
    private string? paymentStatus;
    private string? paymentDate;
    private string? professionalComment;
    private decimal? manualSaleAmount;

    public Guid? BranchId { get; init; }
    public Guid? GroupId { get; init; }
    public IReadOnlyList<Guid>? GroupIds { get; init; }
    public Guid? TargetBranchId { get; init; }
    public IReadOnlyList<Guid>? TargetGroupIds { get; init; }

    public Guid? MembershipCatalogItemId
    {
        get => membershipCatalogItemId;
        init
        {
            membershipCatalogItemId = value;
            PresentSaleFields.Add("membershipCatalogItemId");
        }
    }

    public string? ValidFrom
    {
        get => validFrom;
        init
        {
            validFrom = value;
            PresentSaleFields.Add("validFrom");
        }
    }

    public string? ValidTo
    {
        get => validTo;
        init
        {
            validTo = value;
            PresentSaleFields.Add("validTo");
        }
    }

    public string? PaymentStatus
    {
        get => paymentStatus;
        init
        {
            paymentStatus = value;
            PresentSaleFields.Add("paymentStatus");
        }
    }

    public string? PaymentDate
    {
        get => paymentDate;
        init
        {
            paymentDate = value;
            PresentSaleFields.Add("paymentDate");
        }
    }

    public string? ProfessionalComment
    {
        get => professionalComment;
        init
        {
            professionalComment = value;
            PresentSaleFields.Add("professionalComment");
        }
    }

    public decimal? ManualSaleAmount
    {
        get => manualSaleAmount;
        init
        {
            manualSaleAmount = value;
            PresentSaleFields.Add("manualSaleAmount");
        }
    }

    [JsonIgnore]
    public ISet<string> PresentSaleFields { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalFields { get; init; }
}
