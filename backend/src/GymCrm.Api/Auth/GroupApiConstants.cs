namespace GymCrm.Api.Auth;

internal static class GroupApiConstants
{
    public const string RoutePrefix = "/groups";
    public const string ListRoute = "/";
    public const string TrainerOptionsRoute = "/trainers";
    public const string LegacyTrainerOptionsRoute = "/options/trainers";
    public const string DetailsRoute = "/{id:guid}";
    public const string ClientsRoute = "/{id:guid}/clients";
    public const string TrainersRoute = "/{id:guid}/trainers";

    public const int DefaultPage = 1;
    public const int DefaultTake = 20;
    public const int MaxTake = 100;
    public const int NameMaxLength = 128;
    public const int ScheduleTextMaxLength = 512;
    public const string TrainingStartTimeDisplayFormat = "HH:mm";
    public static readonly string[] SupportedTimeFormats = ["HH:mm", "HH:mm:ss"];
}
