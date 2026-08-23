namespace GymCrm.Api.Auth;

internal static class ScheduleApiConstants
{
    public const string RoutePrefix = "/schedule";
    public const string GroupsRoute = "/groups";
    public const string LessonsRoute = "/lessons";
    public const string LessonByIdRoute = "/lessons/{lessonOccurrenceId:guid}";
    public const string CancellationLessonPreviewRoute = "/lessons/{lessonOccurrenceId:guid}/cancellation/preview";
    public const string CancellationLessonRoute = "/lessons/{lessonOccurrenceId:guid}/cancellation";
    public const string ChangeLessonPreviewRoute = "/lessons/{lessonOccurrenceId:guid}/change/preview";
    public const string ChangeLessonRoute = "/lessons/{lessonOccurrenceId:guid}/change";
    public const string OneOffLessonPreviewRoute = "/lessons/one-off/preview";
    public const string OneOffLessonsRoute = "/lessons/one-off";
    public const string LessonTrainerSubstitutionsPreviewRoute = "/lesson-trainer-substitutions/preview";
    public const string LessonTrainerSubstitutionsRoute = "/lesson-trainer-substitutions";
    public const string LessonTrainerSubstitutionCancellationsPreviewRoute = "/lesson-trainer-substitutions/cancellations/preview";
    public const string LessonTrainerSubstitutionCancellationsRoute = "/lesson-trainer-substitutions/cancellations";
}
