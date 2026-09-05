using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace GymCrm.Api.Auth;

internal static class AttendanceValidationProblems
{
    public static ValidationProblem CreateTrainingDateValidationProblem(string trainingDateFormat)
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["trainingDate"] = [AttendanceResources.InvalidTrainingDate(trainingDateFormat)]
        });
    }

    public static ValidationProblem CreateLessonDateValidationProblem(string lessonDateFormat)
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceValidationProblemsLine20E5c8412a(lessonDateFormat)]
        });
    }

    public static ValidationProblem CreateAttendanceMarksValidationProblem(string message)
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["attendanceMarks"] = [message]
        });
    }

    public static ValidationProblem CreateTrainingDateInFutureValidationProblem()
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["trainingDate"] = [AttendanceResources.TrainingDateInFuture]
        });
    }

    public static ValidationProblem CreateTrainingDateUnavailableValidationProblem()
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["trainingDate"] = [global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceValidationProblemsLine441cd5b8f3]
        });
    }

    public static ProblemHttpResult CreateAttendanceGroupForbiddenProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/attendance-group-forbidden",
            Title = global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceValidationProblemsLine53Bfcdb657,
            Status = StatusCodes.Status403Forbidden,
            Extensions =
            {
                ["code"] = "attendance_group_forbidden"
            }
        });
    }
}
