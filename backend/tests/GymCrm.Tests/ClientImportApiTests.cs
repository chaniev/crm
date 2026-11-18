using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public class ClientImportApiTests
{
    [Theory]
    [InlineData("formula")]
    [InlineData("error")]
    public async Task Unsupported_empty_phone_cell_rejects_the_file_even_with_a_default(string kind)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        var cells = ClientXlsxReaderTests.ValidRow();
        cells[1] = "";
        using var file = ClientXlsxReaderTests.Workbook([cells]);
        ClientXlsxReaderTests.Rewrite(file, "xl/worksheets/sheet1.xml", xml => xml.Replace(
            "<c r=\"B2\" t=\"inlineStr\">",
            kind == "formula" ? "<c r=\"B2\" t=\"inlineStr\"><f>1+1</f>" : "<c r=\"B2\" t=\"e\">", StringComparison.Ordinal));
        var operation = Guid.NewGuid();

        using (client)
        using (var response = await ClientImportPostgreSqlTests.SendImportFileAsync(client, token, factory.OwnBranchId, operation, file))
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(operation, payload.GetProperty("operationId").GetGuid());
            Assert.Equal("file_invalid", payload.GetProperty("code").GetString());
            var issue = Assert.Single(payload.GetProperty("issues").EnumerateArray());
            Assert.Equal(2, issue.GetProperty("row").GetInt32());
            Assert.Equal("phone", issue.GetProperty("field").GetString());
            Assert.Equal("cell_unsupported", issue.GetProperty("code").GetString());
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await db.Clients.ToArrayAsync());
        Assert.Empty(await db.AuditLogs.Where(a => a.ActionType.StartsWith("Client")).ToArrayAsync());
    }

    [Theory]
    [InlineData(768 * 1024, HttpStatusCode.BadRequest)]
    [InlineData(768 * 1024 + 1, HttpStatusCode.RequestEntityTooLarge)]
    public async Task Body_limit_accepts_boundary_for_parsing_and_rejects_one_extra_byte(int length, HttpStatusCode expected)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.SuperAdministrator);
        using (client)
        using (var request = new HttpRequestMessage(HttpMethod.Post, "/clients/import-xlsx"))
        {
            const string prefix = "--boundary\r\nContent-Disposition: form-data; name=\"padding\"\r\n\r\n";
            const string suffix = "\r\n--boundary--\r\n";
            request.Content = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes(prefix + new string('x', length - prefix.Length - suffix.Length) + suffix));
            request.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("multipart/form-data; boundary=boundary");
            request.Headers.Add("X-CSRF-TOKEN", token);
            using var response = await client.SendAsync(request);
            Assert.Equal(expected, response.StatusCode);
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(expected == HttpStatusCode.BadRequest ? "invalid_request" : "import_limit", problem.GetProperty("code").GetString());
        }
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>().Clients.ToArrayAsync());
    }

    [Theory]
    [InlineData("foreign", HttpStatusCode.Forbidden)]
    [InlineData("unassigned", HttpStatusCode.Forbidden)]
    [InlineData("archived", HttpStatusCode.BadRequest)]
    [InlineData("inactive", HttpStatusCode.Unauthorized)]
    [InlineData("password", HttpStatusCode.Forbidden)]
    [InlineData("csrf", HttpStatusCode.BadRequest)]
    [InlineData("missing-group", HttpStatusCode.BadRequest)]
    [InlineData("duplicate-group", HttpStatusCode.BadRequest)]
    public async Task Invalid_access_or_destination_never_creates_clients(string scenario, HttpStatusCode expected)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(u => u.Role == UserRole.Administrator);
            if (scenario == "unassigned") actor.BranchId = null;
            if (scenario == "inactive") actor.IsActive = false;
            if (scenario == "password") actor.MustChangePassword = true;
            if (scenario == "archived") (await db.Branches.SingleAsync(b => b.Id == factory.OwnBranchId)).IsArchived = true;
            var group = await db.TrainingGroups.SingleAsync();
            if (scenario == "missing-group") group.Name = "Other";
            if (scenario == "duplicate-group") db.TrainingGroups.Add(new GymCrm.Domain.Groups.TrainingGroup { Id = Guid.NewGuid(), Name = group.Name, BranchId = group.BranchId, HallId = group.HallId, GroupTypeId = group.GroupTypeId });
            await db.SaveChangesAsync();
        }
        using (client)
        using (var response = await ClientImportPostgreSqlTests.SendImportAsync(client, scenario == "csrf" ? "wrong-token" : token, scenario == "foreign" ? factory.ForeignBranchId : factory.OwnBranchId, Guid.NewGuid()))
            Assert.Equal(expected, response.StatusCode);
        using var verify = factory.Services.CreateScope();
        var context = verify.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await context.Clients.ToArrayAsync());
        Assert.Empty(await context.AuditLogs.Where(a => a.ActionType.StartsWith("Client")).ToArrayAsync());
    }

    [Theory]
    [InlineData(UserRole.SuperAdministrator, "SelectBranch")]
    [InlineData(UserRole.Administrator, "OwnBranch")]
    [InlineData(UserRole.HeadCoach, "None")]
    [InlineData(UserRole.Coach, "None")]
    public async Task Session_exposes_import_scope_independently_of_client_management(UserRole role, string kind)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, _) = await factory.LoginAsync(role);
        using (client)
        {
            var session = await client.GetFromJsonAsync<JsonElement>("/auth/session");
            Assert.True(session.GetProperty("user").TryGetProperty("clientImportScope", out var scope));
            Assert.Equal(kind, scope.GetProperty("kind").GetString());
            Assert.Equal(role == UserRole.Administrator ? factory.OwnBranchId : (Guid?)null,
                scope.GetProperty("branchId").ValueKind == JsonValueKind.Null ? null : scope.GetProperty("branchId").GetGuid());
        }
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(UserRole.HeadCoach, HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Coach, HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Administrator, HttpStatusCode.BadRequest)]
    [InlineData(UserRole.SuperAdministrator, HttpStatusCode.BadRequest)]
    public async Task Import_guards_run_before_file_parsing(UserRole? role, HttpStatusCode expected)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(role);
        using (client)
        using (var request = new HttpRequestMessage(HttpMethod.Post, "/clients/import-xlsx"))
        {
            request.Headers.Add("X-CSRF-TOKEN", token);
            request.Content = new MultipartFormDataContent();
            using var response = await client.SendAsync(request);
            Assert.Equal(expected, response.StatusCode);
        }
    }
}
