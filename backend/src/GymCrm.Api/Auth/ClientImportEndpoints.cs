using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;

namespace GymCrm.Api.Auth;

internal static class ClientImportEndpoints
{
    internal static RouteGroupBuilder MapClientImportEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/import-xlsx", ImportAsync).RequireAuthorization(GymCrmAuthorizationPolicies.ImportClients);
        return group;
    }

    private static async Task<IResult> ImportAsync(HttpContext context, IAntiforgery antiforgery, IClientImportService importer, ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        var requestLimit = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (requestLimit is { IsReadOnly: false }) requestLimit.MaxRequestBodySize = ClientImportLimits.BodyBytes;
        if (!context.Request.Headers.ContainsKey(AuthConstants.CsrfHeaderName))
            return Results.Problem(statusCode: 400, title: AuthConstants.InvalidCsrfProblemTitle, detail: AuthResources.InvalidCsrfProblemDetail);
        var csrf = await AuthCsrfValidation.ValidateRequestAsync(context, antiforgery);
        if (csrf is not null) return csrf;
        var actor = context.GetAuthenticatedGymCrmUser();
        if (actor is null) return Results.Unauthorized();
        Guid? operationId = null;
        IResult Problem(int status, string code, string? field, string message, IReadOnlyList<ClientImportIssue>? issues = null) => Results.Problem(
            statusCode: status, title: message, extensions: new Dictionary<string, object?>
            {
                ["operationId"] = operationId,
                ["code"] = code,
                ["issues"] = issues ?? [new(null, field, code, message)]
            });
        if (context.Request.ContentLength > ClientImportLimits.BodyBytes)
            return Problem(413, "import_limit", "file", ClientImportText.InvalidFile);
        var bodyLimit = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (bodyLimit is { IsReadOnly: false }) bodyLimit.MaxRequestBodySize = ClientImportLimits.BodyBytes;
        if (!MediaTypeHeaderValue.TryParse(context.Request.ContentType, out var mediaType) ||
            !mediaType.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase))
            return Problem(400, "invalid_request", "file", ClientImportText.InvalidRequest);
        var boundary = HeaderUtilities.RemoveQuotes(mediaType.Boundary).Value;
        if (string.IsNullOrEmpty(boundary) || boundary.Length > 128)
            return Problem(400, "invalid_request", "file", ClientImportText.InvalidRequest);
        // A bounded memory body also protects chunked requests on hosts without a size feature.
        using var body = new MemoryStream();
        var bytes = new byte[8192];
        int count;
        try
        {
            while ((count = await context.Request.Body.ReadAsync(bytes, cancellationToken)) > 0)
            {
                if (body.Length + count > ClientImportLimits.BodyBytes) return Problem(413, "import_limit", "file", ClientImportText.InvalidFile);
                body.Write(bytes, 0, count);
            }
            body.Position = 0;
            var multipart = new MultipartReader(boundary, body) { BodyLengthLimit = ClientImportLimits.BodyBytes };
            var fields = new Dictionary<string, string>(StringComparer.Ordinal);
            byte[]? file = null;
            string? filename = null;
            MultipartSection? section;
            while ((section = await multipart.ReadNextSectionAsync(cancellationToken)) is not null)
            {
                if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition)) return Problem(400, "invalid_request", null, ClientImportText.InvalidRequest);
                var name = HeaderUtilities.RemoveQuotes(disposition.Name).Value ?? "";
                if (name == "file")
                {
                    if (file is not null) return Problem(400, "invalid_request", "file", ClientImportText.InvalidRequest);
                    filename = HeaderUtilities.RemoveQuotes(disposition.FileNameStar.HasValue ? disposition.FileNameStar : disposition.FileName).Value;
                    using var content = new MemoryStream();
                    await section.Body.CopyToAsync(content, cancellationToken);
                    if (content.Length > ClientImportLimits.FileBytes) return Problem(413, "import_limit", "file", ClientImportText.InvalidFile);
                    file = content.ToArray();
                }
                else
                {
                    using var text = new StreamReader(section.Body, leaveOpen: true);
                    if (!fields.TryAdd(name, await text.ReadToEndAsync(cancellationToken))) return Problem(400, "invalid_request", name, ClientImportText.InvalidRequest);
                    if (name == "operationId" && Guid.TryParse(fields[name], out var parsed) && parsed != Guid.Empty) operationId = parsed;
                }
            }
            if (operationId is null) return Problem(400, "invalid_request", "operationId", ClientImportText.InvalidRequest);
            if (!Guid.TryParse(fields.GetValueOrDefault("branchId"), out var branchId) || branchId == Guid.Empty)
                return Problem(400, "invalid_request", "branchId", ClientImportText.InvalidRequest);
            if (string.IsNullOrWhiteSpace(fields.GetValueOrDefault("groupName"))) return Problem(400, "invalid_request", "groupName", ClientImportText.InvalidRequest);
            if (!ClientImportScope.Allows(actor, branchId)) return Problem(403, "import_forbidden", null, ClientImportText.Forbidden);
            if (file is not { Length: > 0 } || !string.Equals(Path.GetExtension(filename), ".xlsx", StringComparison.OrdinalIgnoreCase)) return Problem(400, "file_invalid", "file", ClientImportText.InvalidFile);
            using var stream = new MemoryStream(file);
            var result = await importer.ImportAsync(actor.Id, branchId, fields["groupName"], operationId.Value, stream, cancellationToken);
            if (result.Code is null) return Results.Ok(new ClientImportResponse(result.OperationId, result.CreatedCount));
            var status = result.Code switch { "import_forbidden" => 403, "group_changed" => 409, "import_limit" => 413, _ => 400 };
            return Problem(status, result.Code, null, ClientImportText.InvalidRequest, result.Issues);
        }
        catch (InvalidDataException) { return Problem(400, "file_invalid", "file", ClientImportText.InvalidFile); }
        catch (BadHttpRequestException error) when (error.StatusCode == 413) { return Problem(413, "import_limit", "file", ClientImportText.InvalidFile); }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            loggerFactory.CreateLogger("ClientImport").LogError(error, "Client import {OperationId} failed", operationId);
            return Problem(500, "import_failed", null, ClientImportText.InvalidRequest);
        }
    }
}
