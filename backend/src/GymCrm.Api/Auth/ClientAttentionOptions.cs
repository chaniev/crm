using System.ComponentModel.DataAnnotations;

namespace GymCrm.Api.Auth;

internal sealed class ClientAttentionOptions
{
    public const string SectionName = "ClientAttention";

    [Range(0, 365)]
    public int MembershipWindowDays { get; init; } = 3;
}
