using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GymCrm.Tests;

public sealed class ClientBirthDatePersistenceModelTests
{
    [Fact]
    public void Client_birth_date_is_nullable_PostgreSql_date()
    {
        using var dbContext = CreateDbContext();
        var client = dbContext.Model.FindEntityType(typeof(Client));

        Assert.NotNull(client);
        var property = client.FindProperty("BirthDate");
        Assert.NotNull(property);

        Assert.Equal(typeof(DateOnly?), property.ClrType);
        Assert.True(property.IsNullable);
        Assert.Equal("date", property.GetColumnType());
        Assert.DoesNotContain(client.GetIndexes(), index => index.Properties.Any(indexed => indexed.Name == "BirthDate"));
    }

    [Fact]
    public void Clean_bootstrap_schema_contains_nullable_birth_date_without_defaults_or_constraints()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript();

        Assert.Contains("\"BirthDate\" date", script, StringComparison.Ordinal);
        Assert.DoesNotContain("\"BirthDate\" date NOT NULL", script, StringComparison.Ordinal);
        Assert.DoesNotContain("DEFAULT", ExtractClientsCreateTable(script), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("BirthDate", ExtractCheckConstraints(script), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("IX_Clients_BirthDate", script, StringComparison.Ordinal);
    }

    private static string ExtractClientsCreateTable(string script)
    {
        var start = script.IndexOf("CREATE TABLE \"Clients\"", StringComparison.Ordinal);
        Assert.True(start >= 0, "Expected Clients table in generated schema script.");
        var end = script.IndexOf(");", start, StringComparison.Ordinal);
        Assert.True(end > start, "Expected end of Clients create table statement.");
        return script[start..end];
    }

    private static string ExtractCheckConstraints(string script)
    {
        return string.Join(
            '\n',
            script.Split('\n').Where(line => line.Contains("CHECK", StringComparison.OrdinalIgnoreCase)));
    }

    private static GymCrmDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql("Host=localhost;Database=gym_crm_model_tests;Username=unused;Password=unused")
            .Options;

        return new GymCrmDbContext(options);
    }
}
