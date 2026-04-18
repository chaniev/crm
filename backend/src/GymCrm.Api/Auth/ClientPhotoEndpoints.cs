using System.IO;
using GymCrm.Application.Clients;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

namespace GymCrm.Api.Auth;

internal static class ClientPhotoEndpoints
{
    public static IEndpointRouteBuilder MapClientPhotoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGroup("/clients")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients)
            .MapPost("/{id:guid}/photo", UploadClientPhotoAsync);

        endpoints.MapGroup("/clients")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClientPhotos)
            .MapGet("/{id:guid}/photo", GetClientPhotoAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<ClientPhotoResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UploadClientPhotoAsync(
        Guid id,
        HttpContext httpContext,
        IAntiforgery antiforgery,
        IClientPhotoService photoService,
        IOptions<ClientPhotoApiOptions> optionsAccessor,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        if (!httpContext.Request.HasFormContentType)
        {
            return TypedResults.ValidationProblem(CreatePhotoValidationErrors(
                $"Отправьте файл как multipart/form-data в поле '{ClientPhotoApiOptions.FormFieldName}'."));
        }

        var options = optionsAccessor.Value;
        IFormFile? photoFile;

        try
        {
            var form = await httpContext.Request.ReadFormAsync(cancellationToken);
            photoFile = ResolvePhotoFile(form);
        }
        catch (InvalidDataException)
        {
            return CreatePayloadTooLargeProblem(options.MaxUploadSizeBytes);
        }
        catch (BadHttpRequestException exception) when (exception.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return CreatePayloadTooLargeProblem(options.MaxUploadSizeBytes);
        }

        if (photoFile is null)
        {
            return TypedResults.ValidationProblem(CreatePhotoValidationErrors(
                $"Передайте ровно один файл в поле '{ClientPhotoApiOptions.FormFieldName}'."));
        }

        if (photoFile.Length <= 0)
        {
            return TypedResults.ValidationProblem(CreatePhotoValidationErrors("Файл фотографии не должен быть пустым."));
        }

        try
        {
            await using var content = photoFile.OpenReadStream();

            var result = await photoService.UploadAsync(
                id,
                new ClientPhotoUploadCommand
                {
                    RequestedByUserId = currentUser.Id,
                    FileName = photoFile.FileName,
                    ContentType = photoFile.ContentType,
                    Content = content
                },
                cancellationToken);

            return result.Error switch
            {
                ClientPhotoError.None when result.Photo is not null => TypedResults.Ok(
                    new ClientPhotoResponse(
                        id,
                        result.Photo.ContentType,
                        result.Photo.SizeBytes,
                        result.Photo.UploadedAt)),
                ClientPhotoError.ClientMissing => TypedResults.NotFound(),
                ClientPhotoError.FileTooLarge => CreatePayloadTooLargeProblem(options.MaxUploadSizeBytes),
                ClientPhotoError.InvalidRequest => TypedResults.ValidationProblem(
                    CreatePhotoValidationErrors("Передан некорректный файл фотографии.")),
                ClientPhotoError.UnsupportedMediaType => TypedResults.ValidationProblem(
                    CreatePhotoValidationErrors("Допустимы только JPEG, PNG, WebP, HEIC и HEIF.")),
                ClientPhotoError.InvalidImageContent => TypedResults.ValidationProblem(
                    CreatePhotoValidationErrors("Backend не смог распознать содержимое файла как изображение.")),
                ClientPhotoError.ConversionUnavailable => TypedResults.Problem(
                    title: "Не удалось конвертировать фотографию клиента.",
                    detail: "Сервер не поддерживает обработку HEIC/HEIF в текущей конфигурации.",
                    statusCode: StatusCodes.Status500InternalServerError),
                ClientPhotoError.Forbidden => TypedResults.Problem(
                    title: "Недостаточно прав для загрузки фотографии клиента.",
                    detail: "Загрузка фотографии доступна только management-ролям.",
                    statusCode: StatusCodes.Status403Forbidden),
                ClientPhotoError.UserMissing => TypedResults.Unauthorized(),
                _ => TypedResults.Problem(
                    title: "Не удалось сохранить фотографию клиента.",
                    detail: "Сервис фотографии клиента вернул неподдерживаемый результат.",
                    statusCode: StatusCodes.Status500InternalServerError)
            };
        }
        catch (InvalidDataException)
        {
            return CreatePayloadTooLargeProblem(options.MaxUploadSizeBytes);
        }
    }

    private static async Task<Results<FileStreamHttpResult, NotFound, ForbidHttpResult, ProblemHttpResult, UnauthorizedHttpResult>> GetClientPhotoAsync(
        Guid id,
        HttpContext httpContext,
        IClientPhotoService photoService,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var result = await photoService.OpenReadAsync(
            id,
            new ClientPhotoReadCommand(currentUser.Id),
            cancellationToken);

        return result.Error switch
        {
            ClientPhotoError.None when result.Photo is not null => CreatePhotoFileResult(httpContext, result.Photo),
            ClientPhotoError.ClientMissing => TypedResults.NotFound(),
            ClientPhotoError.PhotoMissing => TypedResults.NotFound(),
            ClientPhotoError.Forbidden => TypedResults.Forbid(),
            ClientPhotoError.UserMissing => TypedResults.Unauthorized(),
            _ => TypedResults.Problem(
                title: "Не удалось получить фотографию клиента.",
                detail: "Сервис фотографии клиента вернул неподдерживаемый результат.",
                statusCode: StatusCodes.Status500InternalServerError)
        };
    }

    private static FileStreamHttpResult CreatePhotoFileResult(
        HttpContext httpContext,
        ClientPhotoContentResult file)
    {
        httpContext.Response.Headers.CacheControl = "private, no-store";

        return TypedResults.File(
            file.Content,
            file.ContentType,
            lastModified: file.UploadedAt,
            enableRangeProcessing: false);
    }

    private static IFormFile? ResolvePhotoFile(IFormCollection form)
    {
        if (form.Files.Count != 1)
        {
            return null;
        }

        return form.Files.GetFile(ClientPhotoApiOptions.FormFieldName);
    }

    private static async Task<ProblemHttpResult?> ValidateAntiforgeryAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(httpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return TypedResults.Problem(
                title: AuthConstants.InvalidCsrfProblemTitle,
                detail: AuthConstants.InvalidCsrfProblemDetail,
                statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static Dictionary<string, string[]> CreatePhotoValidationErrors(string message)
    {
        return new Dictionary<string, string[]>
        {
            [ClientPhotoApiOptions.FormFieldName] = [message]
        };
    }

    private static ProblemHttpResult CreatePayloadTooLargeProblem(long maxUploadSizeBytes)
    {
        return TypedResults.Problem(
            title: "Размер фотографии превышает допустимый лимит.",
            detail: $"Максимальный размер файла: {maxUploadSizeBytes} байт.",
            statusCode: StatusCodes.Status413PayloadTooLarge);
    }
}

internal sealed record ClientPhotoResponse(
    Guid ClientId,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAt);
