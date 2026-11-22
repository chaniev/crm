using GymCrm.Application.Security;

namespace GymCrm.Tests;

public class PersonalPasswordPolicyTests
{
    [Theory]
    [InlineData("Passwor1")]
    [InlineData("ПарольЁ1")]
    [InlineData("Ё123456ё")]
    [InlineData("Ёenglish9")]
    [InlineData("Passwor1!")]
    [InlineData("Passwor1+")]
    [InlineData("Passwor1=")]
    [InlineData("Passwor1-")]
    [InlineData("Passwor1@")]
    [InlineData("Passwor1^")]
    [InlineData("Passwor1$")]
    [InlineData("Passwor1#")]
    [InlineData("Passwor1;")]
    public void Accepts_supported_alphabet(string password)
    {
        Assert.Null(PersonalPasswordPolicy.Validate(password));
    }

    [Theory]
    [InlineData("Passwo1", PersonalPasswordError.TooShort)]
    [InlineData("Password", PersonalPasswordError.MissingDigit)]
    [InlineData("password1", PersonalPasswordError.MissingUppercase)]
    [InlineData("PASSWORD1", PersonalPasswordError.MissingLowercase)]
    [InlineData(" Password1", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Pass word1", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1 ", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1\t", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1\n", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1_", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1%", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1é", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1і", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password1😀", PersonalPasswordError.InvalidCharacter)]
    [InlineData("Password١", PersonalPasswordError.InvalidCharacter)]
    public void Reports_specific_violation(string password, PersonalPasswordError expected)
    {
        Assert.Equal(expected, PersonalPasswordPolicy.Validate(password));
    }
}
