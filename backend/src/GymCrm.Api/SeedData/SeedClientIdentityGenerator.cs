namespace GymCrm.Api.SeedData;

internal static class SeedClientIdentityGenerator
{
    private const int PhoneSerialCapacity = 9_999_999;

    private static readonly string[] LastNames =
    [
        "Иванов",
        "Петров",
        "Сидоров",
        "Смирнов",
        "Кузнецов",
        "Попов",
        "Васильев",
        "Новиков",
        "Федоров",
        "Морозов",
        "Волков",
        "Алексеев",
        "Лебедев",
        "Семенов",
        "Егоров"
    ];

    private static readonly string[] FirstNames =
    [
        "Алексей",
        "Дмитрий",
        "Илья",
        "Максим",
        "Никита",
        "Роман",
        "Сергей",
        "Андрей",
        "Павел",
        "Кирилл",
        "Анна",
        "Мария",
        "Екатерина",
        "Ольга",
        "Дарья"
    ];

    private static readonly string[] MiddleNames =
    [
        "Александрович",
        "Дмитриевич",
        "Ильич",
        "Максимович",
        "Сергеевич",
        "Андреевич",
        "Павлович",
        "Александровна",
        "Дмитриевна",
        "Сергеевна"
    ];

    internal static int FullNameCapacity => LastNames.Length * FirstNames.Length * MiddleNames.Length;

    internal static (string LastName, string FirstName, string MiddleName) TakeNextUniqueFullName(
        HashSet<string> usedFullNameKeys,
        ref int candidateNumber)
    {
        while (candidateNumber <= FullNameCapacity)
        {
            var fullName = CreateFullName(candidateNumber);
            candidateNumber++;

            if (usedFullNameKeys.Add(CreateFullNameKey(fullName.LastName, fullName.FirstName, fullName.MiddleName)))
            {
                return fullName;
            }
        }

        throw new InvalidOperationException(
            $"Could not generate a unique full name for a seed client. Available combinations: {FullNameCapacity}.");
    }

    internal static string TakeNextUniquePhone(
        HashSet<string> usedPhoneKeys,
        ref int candidateNumber)
    {
        while (candidateNumber <= PhoneSerialCapacity)
        {
            var phone = CreatePhone(candidateNumber);
            candidateNumber++;

            if (usedPhoneKeys.Add(CreatePhoneKey(phone)))
            {
                return phone;
            }
        }

        throw new InvalidOperationException(
            $"Could not generate a unique phone for a seed client. Available serials: {PhoneSerialCapacity}.");
    }

    internal static (string LastName, string FirstName, string MiddleName) CreateFullName(int number)
    {
        if (number < 1 || number > FullNameCapacity)
        {
            throw new ArgumentOutOfRangeException(
                nameof(number),
                number,
                $"Seed client full name number must be between 1 and {FullNameCapacity}.");
        }

        var zeroBasedNumber = number - 1;
        var lastName = LastNames[zeroBasedNumber % LastNames.Length];
        var firstName = FirstNames[zeroBasedNumber / LastNames.Length % FirstNames.Length];
        var middleName = MiddleNames[zeroBasedNumber / (LastNames.Length * FirstNames.Length) % MiddleNames.Length];

        return (lastName, firstName, middleName);
    }

    internal static string CreatePhone(int number)
    {
        if (number < 1 || number > PhoneSerialCapacity)
        {
            throw new ArgumentOutOfRangeException(
                nameof(number),
                number,
                $"Seed client phone number must be between 1 and {PhoneSerialCapacity}.");
        }

        return $"+7900{number:0000000}";
    }

    internal static string CreateFullNameKey(string? lastName, string? firstName, string? middleName) =>
        string.Join(
            "\u001F",
            NormalizeNamePart(lastName),
            NormalizeNamePart(firstName),
            NormalizeNamePart(middleName));

    internal static string CreatePhoneKey(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return string.Empty;
        }

        return string.Concat(phone.Where(char.IsDigit));
    }

    private static string NormalizeNamePart(string? value) => value?.Trim() ?? string.Empty;
}
