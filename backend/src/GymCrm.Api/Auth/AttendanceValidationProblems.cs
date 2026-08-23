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
            ["lessonDate"] = [$"Дата занятия должна быть в формате {lessonDateFormat}."]
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
            ["trainingDate"] = ["Дата посещаемости недоступна для роли пользователя."]
        });
    }

    public static ProblemHttpResult CreateAttendanceGroupForbiddenProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/attendance-group-forbidden",
            Title = "Attendance group is not available for the current user.",
            Status = StatusCodes.Status403Forbidden,
            Extensions =
            {
                ["code"] = "attendance_group_forbidden"
            }
        });
    }
}
