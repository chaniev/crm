namespace GymCrm.Application.Clients;

public static class ClientImportText
{
    private static readonly System.Resources.ResourceManager Resources = new("GymCrm.Application.Clients.ClientImportText", typeof(ClientImportText).Assembly);
    private static string Get(string key) => Resources.GetString(key, System.Globalization.CultureInfo.CurrentUICulture) ?? throw new InvalidOperationException(key);
    public static string AmbiguousNameToken => Get(nameof(AmbiguousNameToken));
    public static string ActiveStatus => Get(nameof(ActiveStatus));
    public static string CreatedDescription => Get(nameof(CreatedDescription));
    public static string NoteDescription => Get(nameof(NoteDescription));
    public static string CompletedDescription => Get(nameof(CompletedDescription));
    public static string InvalidRequest => Get(nameof(InvalidRequest));
    public static string Forbidden => Get(nameof(Forbidden));
    public static string GroupMissing => Get(nameof(GroupMissing));
    public static string GroupChanged => Get(nameof(GroupChanged));
    public static string BranchInvalid => Get(nameof(BranchInvalid));
    public static string PhoneRequired => Get(nameof(PhoneRequired));
    public static string PhoneTooLong => Get(nameof(PhoneTooLong));
    public static string LastNameTooLong => Get(nameof(LastNameTooLong));
    public static string FirstNameTooLong => Get(nameof(FirstNameTooLong));
    public static string MiddleNameTooLong => Get(nameof(MiddleNameTooLong));
    public static string FullNameRequired => Get(nameof(FullNameRequired));
    public static string Sheet => Get(nameof(Sheet));
    public static readonly string[] Headers = [Get("Header0"), Get("Header1"), Get("Header2"), Get("Header3"), Get("Header4"), Get("Header5"), Get("Header6"), Get("Header7"), Get("Header8"), Get("Header9")];
    public static readonly string[] Fields = ["fullName", "phone", "phoneComment", "email", "birthDate", "gender", "address", "status", "balance", "comment"];
    public static string InvalidFile => Get(nameof(InvalidFile));
    public static string InvalidName => Get(nameof(InvalidName));
    public static string InvalidPhone => Get(nameof(InvalidPhone));
    public static string InvalidBirthDate => Get(nameof(InvalidBirthDate));
    public static string InvalidStatus => Get(nameof(InvalidStatus));
    public static string NotesTooLong => Get(nameof(NotesTooLong));
    public static string AdditionalPhones => Get(nameof(AdditionalPhones));
    public static string SourceBalance => Get(nameof(SourceBalance));
}
