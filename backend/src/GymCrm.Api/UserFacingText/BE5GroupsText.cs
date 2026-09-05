using System.Globalization;
using System.Resources;

namespace GymCrm.Api.UserFacingText;

internal static class BE5GroupsText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.UserFacingText.Resources.BE5GroupsText",
        typeof(BE5GroupsText).Assembly);

    public static string GroupEndpointsLine100703b7e917 => GetString(nameof(GroupEndpointsLine100703b7e917));
    public static string GroupEndpointsLine10129828a59b => GetString(nameof(GroupEndpointsLine10129828a59b));
    public static string GroupEndpointsLine10615d2885e5 => GetString(nameof(GroupEndpointsLine10615d2885e5));
    public static string GroupEndpointsLine10668874f5c8 => GetString(nameof(GroupEndpointsLine10668874f5c8));
    public static string GroupEndpointsLine1078660b92f9(object? value0) => Format(nameof(GroupEndpointsLine1078660b92f9), value0);
    public static string GroupEndpointsLine1130C1ec3b04 => GetString(nameof(GroupEndpointsLine1130C1ec3b04));
    public static string GroupEndpointsLine769Fb0d6e84 => GetString(nameof(GroupEndpointsLine769Fb0d6e84));
    public static string GroupEndpointsLine774A5a49f77 => GetString(nameof(GroupEndpointsLine774A5a49f77));
    public static string GroupEndpointsLine775Ffd3df9e => GetString(nameof(GroupEndpointsLine775Ffd3df9e));
    public static string GroupEndpointsLine7797157135b => GetString(nameof(GroupEndpointsLine7797157135b));
    public static string GroupEndpointsLine9760e729b66 => GetString(nameof(GroupEndpointsLine9760e729b66));
    public static string GroupEndpointsLine9822f1189ff => GetString(nameof(GroupEndpointsLine9822f1189ff));
    public static string GroupEndpointsLine991Ebe48b29 => GetString(nameof(GroupEndpointsLine991Ebe48b29));
    public static string GroupEndpointsLine9976ea9f71c => GetString(nameof(GroupEndpointsLine9976ea9f71c));
    public static string GroupRequestValidatorLine1798418554 => GetString(nameof(GroupRequestValidatorLine1798418554));
    public static string GroupRequestValidatorLine407fd48611 => GetString(nameof(GroupRequestValidatorLine407fd48611));
    public static string GroupTrainerAssignmentEndpointsLine30168f9f19a => GetString(nameof(GroupTrainerAssignmentEndpointsLine30168f9f19a));
    public static string GroupTrainerAssignmentEndpointsLine316A371b159 => GetString(nameof(GroupTrainerAssignmentEndpointsLine316A371b159));
    public static string GroupTrainerAssignmentEndpointsLine3259f8d97b8 => GetString(nameof(GroupTrainerAssignmentEndpointsLine3259f8d97b8));
    public static string GroupTrainerAssignmentEndpointsLine334B78611ed => GetString(nameof(GroupTrainerAssignmentEndpointsLine334B78611ed));
    public static string GroupTrainerAssignmentEndpointsLine3399eb638bc => GetString(nameof(GroupTrainerAssignmentEndpointsLine3399eb638bc));
    public static string GroupTrainerAssignmentEndpointsLine3593a8042c5(object? value0) => Format(nameof(GroupTrainerAssignmentEndpointsLine3593a8042c5), value0);
    public static string GroupTrainerAssignmentEndpointsLine40496c9bf50 => GetString(nameof(GroupTrainerAssignmentEndpointsLine40496c9bf50));
    public static string GroupTrainerAssignmentEndpointsLine67454fd709c => GetString(nameof(GroupTrainerAssignmentEndpointsLine67454fd709c));
    public static string GroupTrainerSubstitutionEndpointsLine1867e830ea8(object? value0) => Format(nameof(GroupTrainerSubstitutionEndpointsLine1867e830ea8), value0);
    public static string GroupTrainerSubstitutionEndpointsLine2641d60c817 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine2641d60c817));
    public static string GroupTrainerSubstitutionEndpointsLine28080144680 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine28080144680));
    public static string GroupTrainerSubstitutionEndpointsLine3319dcc937d(object? value0) => Format(nameof(GroupTrainerSubstitutionEndpointsLine3319dcc937d), value0);
    public static string GroupTrainerSubstitutionEndpointsLine41840f3e7c0(object? value0) => Format(nameof(GroupTrainerSubstitutionEndpointsLine41840f3e7c0), value0);
    public static string GroupTrainerSubstitutionEndpointsLine44780144680 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine44780144680));
    public static string GroupTrainerSubstitutionEndpointsLine4791d60c817 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine4791d60c817));
    public static string GroupTrainerSubstitutionEndpointsLine485688b34f5 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine485688b34f5));
    public static string GroupTrainerSubstitutionEndpointsLine496C99d3372 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine496C99d3372));
    public static string GroupTrainerSubstitutionEndpointsLine500F66e630f => GetString(nameof(GroupTrainerSubstitutionEndpointsLine500F66e630f));
    public static string GroupTrainerSubstitutionEndpointsLine50783c61e4f => GetString(nameof(GroupTrainerSubstitutionEndpointsLine50783c61e4f));
    public static string GroupTrainerSubstitutionEndpointsLine513Df370b9a => GetString(nameof(GroupTrainerSubstitutionEndpointsLine513Df370b9a));
    public static string GroupTrainerSubstitutionEndpointsLine518De43f4f3 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine518De43f4f3));
    public static string GroupTrainerSubstitutionEndpointsLine6495ee85073 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine6495ee85073));
    public static string GroupTrainerSubstitutionEndpointsLine6505ee85073 => GetString(nameof(GroupTrainerSubstitutionEndpointsLine6505ee85073));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
