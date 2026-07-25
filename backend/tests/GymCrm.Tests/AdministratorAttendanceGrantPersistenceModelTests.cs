using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;

namespace GymCrm.Tests;

public sealed class AdministratorAttendanceGrantPersistenceModelTests
{
    [Fact]
    public void Grant_entity_uses_composite_primary_key_and_scope_indexes()
    {
        using var dbContext = CreateDbContext();
        var grant = dbContext.Model.FindEntityType(typeof(AdministratorAttendanceGroupGrant));

        Assert.NotNull(grant);

        var primaryKey = Assert.Single(grant!.GetKeys());
        Assert.Equal(
            [nameof(AdministratorAttendanceGroupGrant.AdministratorId), nameof(AdministratorAttendanceGroupGrant.GroupId)],
            primaryKey.Properties.Select(property => property.Name).ToArray());

        var groupIndex = Assert.Single(
            grant.GetIndexes(),
            index => index.GetDatabaseName() == "IX_AdministratorAttendanceGroupGrants_GroupId");

        var branchIndex = Assert.Single(
            grant.GetIndexes(),
            index => index.GetDatabaseName() == "IX_AdministratorAttendanceGroupGrants_BranchId");

        Assert.Single(groupIndex.Properties, property => property.Name == nameof(AdministratorAttendanceGroupGrant.GroupId));
        Assert.Single(branchIndex.Properties, property => property.Name == nameof(AdministratorAttendanceGroupGrant.BranchId));
    }

    [Fact]
    public void Foreign_keys_are_restrictive_to_prevent_orphaned_grants()
    {
        using var dbContext = CreateDbContext();
        var grant = dbContext.Model.FindEntityType(typeof(AdministratorAttendanceGroupGrant));

        Assert.NotNull(grant);

        var administratorFk = Assert.Single(
            grant!.GetForeignKeys(),
            foreignKey => foreignKey.Properties.Count == 1 &&
                foreignKey.Properties[0].Name == nameof(AdministratorAttendanceGroupGrant.AdministratorId));

        var groupFk = Assert.Single(
            grant.GetForeignKeys(),
            foreignKey => foreignKey.Properties.Count == 1 &&
                foreignKey.Properties[0].Name == nameof(AdministratorAttendanceGroupGrant.GroupId));

        var branchFk = Assert.Single(
            grant.GetForeignKeys(),
            foreignKey => foreignKey.Properties.Count == 1 &&
                foreignKey.Properties[0].Name == nameof(AdministratorAttendanceGroupGrant.BranchId));

        var grantedByFk = Assert.Single(
            grant.GetForeignKeys(),
            foreignKey => foreignKey.Properties.Count == 1 &&
                foreignKey.Properties[0].Name == nameof(AdministratorAttendanceGroupGrant.GrantedByUserId));

        Assert.Equal(
            typeof(User),
            administratorFk.PrincipalEntityType.ClrType);

        Assert.Equal(
            typeof(TrainingGroup),
            groupFk.PrincipalEntityType.ClrType);

        Assert.Equal(
            typeof(Branch),
            branchFk.PrincipalEntityType.ClrType);

        Assert.Equal(
            typeof(User),
            grantedByFk.PrincipalEntityType.ClrType);

        Assert.Equal(DeleteBehavior.Restrict, administratorFk.DeleteBehavior);
        Assert.Equal(DeleteBehavior.Restrict, groupFk.DeleteBehavior);
        Assert.Equal(DeleteBehavior.Restrict, branchFk.DeleteBehavior);
        Assert.Equal(DeleteBehavior.Restrict, grantedByFk.DeleteBehavior);
    }

    [Fact]
    public void Initial_schema_contains_administrator_grant_indexes_and_restrictive_fks()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript();

        Assert.Contains("CREATE TABLE \"AdministratorAttendanceGroupGrants\"", script, StringComparison.Ordinal);
        Assert.Contains("PK_AdministratorAttendanceGroupGrants", script, StringComparison.Ordinal);
        Assert.Contains("IX_AdministratorAttendanceGroupGrants_GroupId", script, StringComparison.Ordinal);
        Assert.Contains("IX_AdministratorAttendanceGroupGrants_BranchId", script, StringComparison.Ordinal);

        Assert.Contains("FK_AdministratorAttendanceGroupGrants_Users_AdministratorId", script, StringComparison.Ordinal);
        Assert.Contains("FK_AdministratorAttendanceGroupGrants_TrainingGroups_GroupId", script, StringComparison.Ordinal);
        Assert.Contains("FK_AdministratorAttendanceGroupGrants_Branches_BranchId", script, StringComparison.Ordinal);
        Assert.Contains("FK_AdministratorAttendanceGroupGrants_Users_GrantedByUserId", script, StringComparison.Ordinal);
        Assert.Contains("ON DELETE RESTRICT", script, StringComparison.Ordinal);
    }

    private static GymCrmDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql("Host=localhost;Database=gym_crm_model_tests;Username=unused;Password=unused")
            .Options;

        return new GymCrmDbContext(options);
    }
}
