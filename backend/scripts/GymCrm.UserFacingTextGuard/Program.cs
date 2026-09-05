using GymCrm.UserFacingTextGuard;

var repositoryRoot = args.Length == 1
    ? Path.GetFullPath(args[0])
    : FindRepositoryRoot(AppContext.BaseDirectory);
var result = await UserFacingTextScanner.ScanAsync(repositoryRoot);
foreach (var violation in result.Violations)
{
    Console.Error.WriteLine($"{violation.Path}:{violation.Line}: user-facing Cyrillic literal: {violation.Value}");
}
foreach (var stale in result.StaleAllowlist)
{
    Console.Error.WriteLine($"{stale.Path}: stale user-facing-text allowlist entry {stale.Fingerprint}");
}
if (result.Violations.Count > 0 || result.StaleAllowlist.Count > 0) return 1;
Console.WriteLine($"Backend user-facing literal guard passed; {result.SeenExceptions} classified fixtures.");
return 0;

static string FindRepositoryRoot(string start)
{
    for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
    {
        if (Directory.Exists(Path.Combine(directory.FullName, ".git"))) return directory.FullName;
    }
    throw new InvalidOperationException("Repository root was not found.");
}
