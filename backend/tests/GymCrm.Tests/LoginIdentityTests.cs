using GymCrm.Domain.Users;

namespace GymCrm.Tests;

public sealed class LoginIdentityTests
{
    public static TheoryData<string, string> SameIdentityPairs => new()
    {
        { "Coach", "coach" },
        { "Coach", "COACH" },
        { "Coach", "  CoAcH  " },
        { "ТренерЛенинский", "тренерленинский" },
        { "ТренерЛенинский", "ТРЕНЕРЛЕНИНСКИЙ" },
        { "ТренерЛенинский", "  ТренерЛеНиНсКий " },
        { "admin.Ёлка-01", "ADMIN.ёлка-01" },
        { "sa", "SA" }
    };

    [Theory]
    [MemberData(nameof(SameIdentityPairs))]
    public void Same_identity_inputs_produce_one_stable_normalized_key(string stored, string input)
    {
        Assert.Equal(LoginIdentity.NormalizeKey(stored), LoginIdentity.NormalizeKey(input));
    }

    [Theory]
    [InlineData("  Coach  ", "coach")]
    [InlineData("Тренер Ёлкин ", "тренер ёлкин")]
    [InlineData("SA", "sa")]
    [InlineData("\tMixed.Space-01\n", "mixed.space-01")]
    [InlineData("ЁЛКА-01", "ёлка-01")]
    [InlineData("", "")]
    [InlineData("   ", "")]
    public void Normalize_key_trims_and_lowercases_invariantly(string input, string expected)
    {
        Assert.Equal(expected, LoginIdentity.NormalizeKey(input));
    }

    [Theory]
    [InlineData("coach", "coach2")]
    [InlineData("coach", "coac h")]
    [InlineData("ёлка", "йолка")]
    public void Logins_that_differ_beyond_case_keep_distinct_keys(string first, string second)
    {
        Assert.NotEqual(LoginIdentity.NormalizeKey(first), LoginIdentity.NormalizeKey(second));
    }
}
