namespace GymCrm.Application.Security;

public static class PersonalPasswordPolicy
{
    public static PersonalPasswordError? Validate(string password)
    {
        if (password.Length < 8)
        {
            return PersonalPasswordError.TooShort;
        }

        var hasDigit = false;
        var hasUppercase = false;
        var hasLowercase = false;
        foreach (var character in password)
        {
            switch (character)
            {
                case >= '0' and <= '9':
                    hasDigit = true;
                    break;
                case >= 'A' and <= 'Z' or >= 'А' and <= 'Я' or 'Ё':
                    hasUppercase = true;
                    break;
                case >= 'a' and <= 'z' or >= 'а' and <= 'я' or 'ё':
                    hasLowercase = true;
                    break;
                case '!' or '+' or '=' or '-' or '@' or '^' or '$' or '#' or ';':
                    break;
                default:
                    return PersonalPasswordError.InvalidCharacter;
            }
        }

        if (!hasDigit)
        {
            return PersonalPasswordError.MissingDigit;
        }

        if (!hasUppercase)
        {
            return PersonalPasswordError.MissingUppercase;
        }

        return hasLowercase ? null : PersonalPasswordError.MissingLowercase;
    }
}
