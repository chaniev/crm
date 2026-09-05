using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Reflection;
using GymCrm.Application.Clients;
using GymCrm.UserFacingTextGuard;

namespace GymCrm.Tests;

public sealed class UserFacingTextScannerTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), $"task165-backend-scanner-{Guid.NewGuid():N}");

    [Fact]
    public async Task Visible_copy_is_rejected_while_route_code_telemetry_and_resources_are_accepted()
    {
        var paths = await CreateFixtureAsync(new Dictionary<string, string>
        {
            ["backend/src/Visible.cs"] = "class Visible { string Text => \"Сохранить\"; }",
            ["backend/src/Contracts.cs"] = "class Contracts { string Route = \"/клиенты\"; string ErrorCode = \"ошибка\"; void Log() => Console.WriteLine(\"Диагностика\"); }",
            ["backend/src/UserFacingText/Resources.cs"] = "class Resources { string Text => \"Ресурс\"; }",
        });

        var result = await UserFacingTextScanner.ScanAsync(paths.SourceRoot, paths.Exceptions, paths.Allowlist, root);

        var violation = Assert.Single(result.Violations);
        Assert.Equal("Сохранить", violation.Value);
    }

    [Fact]
    public async Task Exact_allowlist_entry_becomes_stale_when_literal_disappears()
    {
        var paths = await CreateFixtureAsync(new Dictionary<string, string>
        {
            ["backend/src/Clean.cs"] = "class Clean { string Code = \"clean\"; }",
        });
        await WriteEntriesAsync(paths.Allowlist, new[] { new
        {
            path = "backend/src/Clean.cs",
            fingerprint = Fingerprint("Удалённый текст"),
        }});

        var result = await UserFacingTextScanner.ScanAsync(paths.SourceRoot, paths.Exceptions, paths.Allowlist, root);

        Assert.Single(result.StaleAllowlist);
    }

    [Fact]
    public void Missing_required_resource_key_fails_explicitly()
    {
        var resources = typeof(ClientMembershipTargetPolicy).Assembly
            .GetType("GymCrm.Application.UserFacingText.ClientMembershipText", throwOnError: true)!;
        var getString = resources.GetMethod("GetString", BindingFlags.NonPublic | BindingFlags.Static)!;

        var error = Assert.Throws<TargetInvocationException>(() => getString.Invoke(null, ["MissingTask165Key"]));

        var missing = Assert.IsType<InvalidOperationException>(error.InnerException);
        Assert.Equal("Resource string 'MissingTask165Key' was not found.", missing.Message);
    }

    public void Dispose()
    {
        if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
    }

    private async Task<(string SourceRoot, string Exceptions, string Allowlist)> CreateFixtureAsync(
        IReadOnlyDictionary<string, string> files)
    {
        foreach (var (path, contents) in files)
        {
            var absolute = Path.Combine(root, path);
            Directory.CreateDirectory(Path.GetDirectoryName(absolute)!);
            await File.WriteAllTextAsync(absolute, contents);
        }
        var exceptions = Path.Combine(root, "exceptions.json");
        var allowlist = Path.Combine(root, "allowlist.json");
        await WriteEntriesAsync(exceptions, Array.Empty<object>());
        await WriteEntriesAsync(allowlist, Array.Empty<object>());
        return (Path.Combine(root, "backend/src"), exceptions, allowlist);
    }

    private static Task WriteEntriesAsync<T>(string path, IEnumerable<T> entries) =>
        File.WriteAllTextAsync(path, JsonSerializer.Serialize(new { entries }));

    private static string Fingerprint(string value) =>
        "sha256:" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
