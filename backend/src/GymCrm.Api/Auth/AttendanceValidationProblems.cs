using Microsoft.AspNetCore.Http.HttpResults;

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

    public static ValidationProblem CreateAttendanceMarksValidationProblem(string message)
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["attendanceMarks"] = [message]
        });
    }
}
