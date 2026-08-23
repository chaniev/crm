using GymCrm.Application.Scheduling;

namespace GymCrm.Tests;

public sealed class ScheduleMutationTokenPolicyTests
{
    [Fact]
    public void One_off_payload_hash_is_stable_and_rejects_changed_command()
    {
        var payload = new ScheduleOneOffConfirmationPayload(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "2026-08-20",
            "10:30",
            60,
            Guid.Parse("33333333-3333-3333-3333-333333333333"));
        var changed = payload with { StartTime = "10:45" };
        var payloadJson = ScheduleMutationTokenPolicy.SerializePayload(payload);
        var hash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(payloadJson);

        Assert.Equal(payload, ScheduleMutationTokenPolicy.DeserializePayload(payloadJson));
        Assert.True(ScheduleMutationTokenPolicy.PayloadMatches(hash, payload));
        Assert.False(ScheduleMutationTokenPolicy.PayloadMatches(hash, changed));
    }

    [Fact]
    public void Secure_token_is_opaque_base64url_value()
    {
        var token = ScheduleMutationTokenPolicy.CreateSecureToken();

        Assert.DoesNotContain("+", token, StringComparison.Ordinal);
        Assert.DoesNotContain("/", token, StringComparison.Ordinal);
        Assert.DoesNotContain("=", token, StringComparison.Ordinal);
        Assert.True(token.Length >= 32);
    }
}
