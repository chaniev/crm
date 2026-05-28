using System.Security.Cryptography;
using System.Text;

namespace GymCrm.Api.SeedData;

internal static class SeedIds
{
    public const int GroupTypeCount = 4;
    public const int BranchCount = 4;
    public const int HallCount = 12;
    public const int CoachCount = 10;
    public const int AdministratorCount = 5;
    public const int TrainingGroupCount = 30;
    public const int ClientCount = 300;

    private const string Namespace = "gym-crm-test-data:v1";

    public static Guid GroupType(int number) => Create($"group-type:{number:00}");

    public static Guid Branch(int number) => Create($"branch:{number:00}");

    public static Guid Hall(int branchNumber, int hallNumber) =>
        Create($"branch:{branchNumber:00}:hall:{hallNumber:00}");

    public static Guid Coach(int number) => Create($"coach:{number:00}");

    public static Guid Administrator(int number) => Create($"administrator:{number:00}");

    public static Guid TrainingGroup(int number) => Create($"training-group:{number:00}");

    public static Guid GroupTrainerAssignment(int groupNumber) =>
        Create($"group-trainer-assignment:{groupNumber:00}");

    public static Guid Client(int number) => Create($"client:{number:000}");

    public static Guid ClientBranchAssignment(int clientNumber) =>
        Create($"client-branch-assignment:{clientNumber:000}");

    public static Guid ClientGroupAssignment(int clientNumber) =>
        Create($"client-group-assignment:{clientNumber:000}");

    public static Guid[] GroupTypeIds =>
        Enumerable.Range(1, GroupTypeCount).Select(GroupType).ToArray();

    public static Guid[] BranchIds =>
        Enumerable.Range(1, BranchCount).Select(Branch).ToArray();

    public static Guid[] HallIds =>
        Enumerable.Range(1, BranchCount)
            .SelectMany(branchNumber => Enumerable.Range(1, 3)
                .Select(hallNumber => Hall(branchNumber, hallNumber)))
            .ToArray();

    public static Guid[] UserIds =>
        Enumerable.Range(1, AdministratorCount)
            .Select(Administrator)
            .Concat(Enumerable.Range(1, CoachCount).Select(Coach))
            .ToArray();

    public static Guid[] TrainingGroupIds =>
        Enumerable.Range(1, TrainingGroupCount).Select(TrainingGroup).ToArray();

    public static Guid[] ClientIds =>
        Enumerable.Range(1, ClientCount).Select(Client).ToArray();

    private static Guid Create(string key)
    {
        var input = Encoding.UTF8.GetBytes($"{Namespace}:{key}");
        var hash = SHA256.HashData(input);
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);

        return new Guid(bytes);
    }
}
