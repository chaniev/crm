using System.Globalization;
using System.Resources;

namespace GymCrm.Api.UserFacingText;

internal static class BE2ClientsText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.UserFacingText.Resources.BE2ClientsText",
        typeof(BE2ClientsText).Assembly);

    public static string ClientAttentionEndpointsLine173Dd1c7f12(object? value0, object? value1, object? value2) => Format(nameof(ClientAttentionEndpointsLine173Dd1c7f12), value0, value1, value2);
    public static string ClientEndpointSharedHelpersLine25Ca8e5605(object? value0) => Format(nameof(ClientEndpointSharedHelpersLine25Ca8e5605), value0);
    public static string ClientLifecycleRequestValidationLine2507c41b898 => GetString(nameof(ClientLifecycleRequestValidationLine2507c41b898));
    public static string ClientMessengerEndpointsLine15293f6981b => GetString(nameof(ClientMessengerEndpointsLine15293f6981b));
    public static string ClientMessengerEndpointsLine15360d64715 => GetString(nameof(ClientMessengerEndpointsLine15360d64715));
    public static string ClientMessengerEndpointsLine156D513a3a1 => GetString(nameof(ClientMessengerEndpointsLine156D513a3a1));
    public static string ClientMessengerEndpointsLine157538bb04e => GetString(nameof(ClientMessengerEndpointsLine157538bb04e));
    public static string ClientMessengerEndpointsLine160Ab3a6efa => GetString(nameof(ClientMessengerEndpointsLine160Ab3a6efa));
    public static string ClientMessengerEndpointsLine16378914546 => GetString(nameof(ClientMessengerEndpointsLine16378914546));
    public static string ClientQueryEndpointsLine69059e5d707 => GetString(nameof(ClientQueryEndpointsLine69059e5d707));
    public static string ClientQueryEndpointsLine748A4baec14(object? value0) => Format(nameof(ClientQueryEndpointsLine748A4baec14), value0);
    public static string ClientQueryEndpointsLine8514606f73e => GetString(nameof(ClientQueryEndpointsLine8514606f73e));
    public static string ClientResponseMapperLine5166bd8ee2e => GetString(nameof(ClientResponseMapperLine5166bd8ee2e));
    public static string ClientResponseMapperLine51867fa40bd => GetString(nameof(ClientResponseMapperLine51867fa40bd));
    public static string ClientResponseMapperLine527C76b894e => GetString(nameof(ClientResponseMapperLine527C76b894e));
    public static string ClientResponseMapperLine528F5e76471 => GetString(nameof(ClientResponseMapperLine528F5e76471));
    public static string ClientResponseMapperLine54063e29a54 => GetString(nameof(ClientResponseMapperLine54063e29a54));
    public static string ClientResponseMapperLine541202af31a => GetString(nameof(ClientResponseMapperLine541202af31a));
    public static string ClientResponseMapperLine560B62f978a => GetString(nameof(ClientResponseMapperLine560B62f978a));
    public static string ClientResponseMapperLine561818b63db => GetString(nameof(ClientResponseMapperLine561818b63db));
    public static string ClientResponseMapperLine569B62f978a => GetString(nameof(ClientResponseMapperLine569B62f978a));
    public static string ClientResponseMapperLine571679f07cb => GetString(nameof(ClientResponseMapperLine571679f07cb));
    public static string ClientResponseMapperLine572D51da79f(object? value0) => Format(nameof(ClientResponseMapperLine572D51da79f), value0);
    public static string ClientResponseMapperLine58463e29a54 => GetString(nameof(ClientResponseMapperLine58463e29a54));
    public static string ClientResponseMapperLine585Fa507898 => GetString(nameof(ClientResponseMapperLine585Fa507898));
    public static string ClientResponseMapperLine594De3830e7 => GetString(nameof(ClientResponseMapperLine594De3830e7));
    public static string ClientResponseMapperLine5952baf9f33 => GetString(nameof(ClientResponseMapperLine5952baf9f33));
    public static string ClientResponseMapperLine605C76b894e => GetString(nameof(ClientResponseMapperLine605C76b894e));
    public static string ClientResponseMapperLine606F5e76471 => GetString(nameof(ClientResponseMapperLine606F5e76471));
    public static string ClientResponseMapperLine615C19bb335 => GetString(nameof(ClientResponseMapperLine615C19bb335));
    public static string ClientResponseMapperLine61688f78723 => GetString(nameof(ClientResponseMapperLine61688f78723));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}