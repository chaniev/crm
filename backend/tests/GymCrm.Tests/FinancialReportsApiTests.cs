using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class FinancialReportsApiTests
{
    [Fact]
    public async Task HeadCoach_can_read_month_report_with_sales_refunds_attribution_and_breakdowns()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/reports/financial?periodPreset=month&anchorDate=2026-05-14");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertPeriod(payload, "month", "2026-05-14", "2026-05-01", "2026-05-31");
        AssertTotals(payload.GetProperty("totals"), 6, 670m, 170m, 500m, 5);

        var branchA = FindRow(payload.GetProperty("branchBreakdown"), "branchId", seeded.BranchAId);
        AssertTotals(branchA, 4, 590m, 170m, 420m, 4);

        var branchB = FindRow(payload.GetProperty("branchBreakdown"), "branchId", seeded.BranchBId);
        AssertTotals(branchB, 2, 80m, 0m, 80m, 1);

        var groupA = FindRow(payload.GetProperty("groupBreakdown"), "groupId", seeded.GroupAId);
        AssertTotals(groupA, 4, 590m, 170m, 420m, 4);

        var groupB = FindRow(payload.GetProperty("groupBreakdown"), "groupId", seeded.GroupBId);
        AssertTotals(groupB, 2, 80m, 0m, 80m, 1);

        var trainerOne = FindRow(payload.GetProperty("trainerBreakdown"), "trainerId", seeded.CoachOneId);
        AssertTotals(trainerOne, 4, 590m, 170m, 420m, 4);

        var trainerTwo = FindRow(payload.GetProperty("trainerBreakdown"), "trainerId", seeded.CoachTwoId);
        AssertTotals(trainerTwo, 2, 80m, 0m, 80m, 1);
    }

    [Fact]
    public async Task Branch_filter_uses_client_branch_period_on_financial_event_date()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync($"/reports/financial?periodPreset=month&anchorDate=2026-05-14&branchId={seeded.BranchAId}");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertTotals(payload.GetProperty("totals"), 4, 590m, 170m, 420m, 4);
        Assert.Single(payload.GetProperty("branchBreakdown").EnumerateArray());
        Assert.Equal(seeded.BranchAId.ToString(), payload.GetProperty("branchBreakdown")[0].GetProperty("branchId").GetString());
    }

    [Fact]
    public async Task Backdated_sale_uses_payment_date_for_period_and_purchase_date_for_attribution()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = new DateTimeOffset(2026, 5, 14, 12, 0, 0, TimeSpan.Zero);
            var client = CreateClient(seeded.BranchAId, "Backdated", now);
            dbContext.Clients.Add(client);
            AddClientBranchPeriod(
                dbContext,
                client.Id,
                seeded.BranchAId,
                new DateOnly(2026, 5, 14),
                null,
                seeded.HeadCoachId,
                now);
            var sale = AddSale(
                dbContext,
                client.Id,
                new DateOnly(2026, 5, 14),
                999m,
                seeded.HeadCoachId,
                now);
            sale.PaymentDate = new DateOnly(2026, 4, 30);
            await dbContext.SaveChangesAsync();
        }

        using var clientHttp = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(clientHttp, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await clientHttp.GetAsync("/reports/financial?periodPreset=custom&from=2026-04-30&to=2026-04-30");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertTotals(payload.GetProperty("totals"), 1, 999m, 0m, 999m, 1);
        var branch = FindRow(payload.GetProperty("branchBreakdown"), "branchId", seeded.BranchAId);
        AssertTotals(branch, 1, 999m, 0m, 999m, 1);
    }

    [Theory]
    [InlineData("quarter", "2026-04-01", "2026-06-30", 7, 870, 170, 700, 6)]
    [InlineData("year", "2026-01-01", "2026-12-31", 7, 870, 170, 700, 6)]
    public async Task Quick_period_presets_are_normalized_deterministically(
        string preset,
        string expectedFrom,
        string expectedTo,
        int soldCount,
        decimal gross,
        decimal refunds,
        decimal net,
        int newClients)
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync($"/reports/financial?periodPreset={preset}&anchorDate=2026-05-14");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertPeriod(payload, preset, "2026-05-14", expectedFrom, expectedTo);
        AssertTotals(payload.GetProperty("totals"), soldCount, gross, refunds, net, newClients);
    }

    [Fact]
    public async Task Custom_period_is_inclusive_and_uses_explicit_boundaries()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/reports/financial?periodPreset=custom&from=2026-05-10&to=2026-05-15");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertPeriod(payload, "custom", null, "2026-05-10", "2026-05-15");
        AssertTotals(payload.GetProperty("totals"), 4, 520m, 30m, 490m, 4);
    }

    [Fact]
    public async Task Corrected_sale_row_date_and_amount_drive_the_report()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var correctedSale = await dbContext.ClientMembershipSales
                .SingleAsync(sale => sale.GrossAmount == 200m);
            correctedSale.PaymentDate = new DateOnly(2026, 5, 2);
            correctedSale.GrossAmount = 250m;
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/reports/financial?periodPreset=month&anchorDate=2026-05-14");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertTotals(payload.GetProperty("totals"), 7, 920m, 170m, 750m, 6);
    }

    [Fact]
    public async Task Amount_only_sale_without_catalog_uses_canonical_gross_in_report()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var amountOnlySale = await dbContext.ClientMembershipSales
                .SingleAsync(sale => sale.GrossAmount == 200m);
            amountOnlySale.MembershipCatalogItemId = null;
            amountOnlySale.MembershipCatalogItem = null;
            amountOnlySale.PricingMode = ClientMembershipSalePricingMode.AmountOnly;
            amountOnlySale.PaymentDate = new DateOnly(2026, 5, 2);
            amountOnlySale.GrossAmount = 333m;
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/reports/financial?periodPreset=month&anchorDate=2026-05-14");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertTotals(payload.GetProperty("totals"), 7, 1003m, 170m, 833m, 6);
    }

    [Theory]
    [InlineData("/reports/financial", "periodPreset")]
    [InlineData("/reports/financial?periodPreset=week&anchorDate=2026-05-14", "periodPreset")]
    [InlineData("/reports/financial?periodPreset=month", "anchorDate")]
    [InlineData("/reports/financial?periodPreset=month&anchorDate=2026-05-14&from=2026-05-01", "from")]
    [InlineData("/reports/financial?periodPreset=custom&from=2026-06-01&to=2026-05-01", "to")]
    [InlineData("/reports/financial?periodPreset=custom&anchorDate=2026-05-14&from=2026-05-01&to=2026-05-31", "anchorDate")]
    [InlineData("/reports/financial?periodPreset=custom&from=2026-05-99&to=2026-05-31", "from")]
    public async Task Invalid_period_filters_return_validation_problem(string path, string expectedErrorKey)
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync(path);
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(payload.GetProperty("errors").TryGetProperty(expectedErrorKey, out _));
    }

    [Fact]
    public async Task Invalid_branch_and_trainer_filters_return_validation_problem()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var missingBranchResponse = await client.GetAsync($"/reports/financial?periodPreset=month&anchorDate=2026-05-14&branchId={Guid.NewGuid()}"))
        {
            var payload = await ReadJsonElementAsync(missingBranchResponse);
            Assert.Equal(HttpStatusCode.BadRequest, missingBranchResponse.StatusCode);
            Assert.True(payload.GetProperty("errors").TryGetProperty("branchId", out _));
        }

        using (var nonCoachTrainerResponse = await client.GetAsync($"/reports/financial?periodPreset=month&anchorDate=2026-05-14&trainerId={seeded.AdministratorId}"))
        {
            var payload = await ReadJsonElementAsync(nonCoachTrainerResponse);
            Assert.Equal(HttpStatusCode.BadRequest, nonCoachTrainerResponse.StatusCode);
            Assert.True(payload.GetProperty("errors").TryGetProperty("trainerId", out _));
        }
    }

    [Fact]
    public async Task HeadCoach_trainer_filter_is_accepted_when_headcoach_has_group_attribution()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync($"/reports/financial?periodPreset=month&anchorDate=2026-05-14&trainerId={seeded.HeadCoachId}");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertTotals(payload.GetProperty("totals"), 4, 590m, 170m, 420m, 4);

        var group = Assert.Single(payload.GetProperty("groupBreakdown").EnumerateArray());
        Assert.Equal(seeded.GroupAId.ToString(), group.GetProperty("groupId").GetString());
        AssertTotals(group, 4, 590m, 170m, 420m, 4);

        var trainer = Assert.Single(payload.GetProperty("trainerBreakdown").EnumerateArray());
        Assert.Equal(seeded.HeadCoachId.ToString(), trainer.GetProperty("trainerId").GetString());
        AssertTotals(trainer, 4, 590m, 170m, 420m, 4);
    }

    [Fact]
    public async Task Administrator_and_coach_are_forbidden_from_financial_reports()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedReportDataAsync(factory);

        using var administratorClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(administratorClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using var administratorResponse = await administratorClient.GetAsync("/reports/financial?periodPreset=month&anchorDate=2026-05-14");
        Assert.Equal(HttpStatusCode.Forbidden, administratorResponse.StatusCode);

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(coachClient, seeded.CoachOneLogin, seeded.SharedPassword);

        using var coachResponse = await coachClient.GetAsync("/reports/financial?periodPreset=month&anchorDate=2026-05-14");
        Assert.Equal(HttpStatusCode.Forbidden, coachResponse.StatusCode);
    }

    [Fact]
    public async Task Trainer_filter_keeps_canonical_totals_event_level_while_breakdowns_can_duplicate()
    {
        await using var factory = new FinancialReportsAppFactory();
        var seeded = await SeedDuplicatedTrainerAttributionDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync($"/reports/financial?periodPreset=month&anchorDate=2026-05-14&trainerId={seeded.CoachOneId}");
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertTotals(payload.GetProperty("totals"), 1, 100m, 0m, 100m, 1);

        var groups = payload.GetProperty("groupBreakdown").EnumerateArray().ToArray();
        Assert.Equal(2, groups.Length);
        Assert.All(groups, group => AssertTotals(group, 1, 100m, 0m, 100m, 1));

        var trainer = Assert.Single(payload.GetProperty("trainerBreakdown").EnumerateArray());
        Assert.Equal(seeded.CoachOneId.ToString(), trainer.GetProperty("trainerId").GetString());
        AssertTotals(trainer, 2, 200m, 0m, 200m, 2);
    }

    private static async Task<SeededReportData> SeedReportDataAsync(FinancialReportsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = new DateTimeOffset(2026, 5, 14, 12, 0, 0, TimeSpan.Zero);
        var sharedPassword = "financial-reports-password";
        var headCoach = CreateUser("headcoach-reports", "Главный тренер Reports", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-reports", "Администратор Reports", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coachOne = CreateUser("coach-one-reports", "Тренер Reports 1", UserRole.Coach, sharedPassword, now, passwordHashService);
        var coachTwo = CreateUser("coach-two-reports", "Тренер Reports 2", UserRole.Coach, sharedPassword, now, passwordHashService);

        var branchA = CreateBranch("Reports Branch A", now);
        var branchB = CreateBranch("Reports Branch B", now);
        var hallA = CreateHall(branchA.Id, "Reports Hall A", now);
        var hallB = CreateHall(branchB.Id, "Reports Hall B", now);
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Reports Group Type",
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupA = CreateGroup(branchA.Id, hallA.Id, groupType.Id, "Reports Group A", now);
        var groupB = CreateGroup(branchB.Id, hallB.Id, groupType.Id, "Reports Group B", now);

        var clientA = CreateClient(branchA.Id, "A", now);
        var clientB = CreateClient(branchA.Id, "B", now);
        var clientC = CreateClient(branchB.Id, "C", now);
        var clientD = CreateClient(branchA.Id, "D", now);
        var clientE = CreateClient(branchA.Id, "E", now);
        var clientF = CreateClient(branchA.Id, "F", now);

        dbContext.Users.AddRange(headCoach, administrator, coachOne, coachTwo);
        dbContext.Branches.AddRange(branchA, branchB);
        dbContext.Halls.AddRange(hallA, hallB);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(groupA, groupB);
        dbContext.Clients.AddRange(clientA, clientB, clientC, clientD, clientE, clientF);

        AddClientBranchPeriod(dbContext, clientA.Id, branchA.Id, new DateOnly(2026, 1, 1), new DateOnly(2026, 5, 20), headCoach.Id, now);
        AddClientBranchPeriod(dbContext, clientA.Id, branchB.Id, new DateOnly(2026, 5, 20), null, headCoach.Id, now);
        AddClientBranchPeriod(dbContext, clientB.Id, branchA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientBranchPeriod(dbContext, clientC.Id, branchB.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientBranchPeriod(dbContext, clientD.Id, branchA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientBranchPeriod(dbContext, clientE.Id, branchA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientBranchPeriod(dbContext, clientF.Id, branchA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);

        AddClientGroupPeriod(dbContext, clientA.Id, groupA.Id, new DateOnly(2026, 1, 1), new DateOnly(2026, 5, 20), headCoach.Id, now);
        AddClientGroupPeriod(dbContext, clientA.Id, groupB.Id, new DateOnly(2026, 5, 20), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, clientB.Id, groupA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, clientC.Id, groupB.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, clientD.Id, groupA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, clientE.Id, groupA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, clientF.Id, groupA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);

        AddGroupTrainerPeriod(dbContext, groupA.Id, headCoach.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddGroupTrainerPeriod(dbContext, groupA.Id, coachOne.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddGroupTrainerPeriod(dbContext, groupB.Id, coachTwo.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);

        var saleA1 = AddSale(dbContext, clientA.Id, new DateOnly(2026, 5, 10), 100m, headCoach.Id, now);
        AddTechnicalMembershipVersions(dbContext, clientA.Id, saleA1.Id, headCoach.Id, now);
        AddSale(dbContext, clientA.Id, new DateOnly(2026, 5, 20), 80m, headCoach.Id, now);

        var saleB = AddSale(dbContext, clientB.Id, new DateOnly(2026, 4, 10), 200m, headCoach.Id, now.AddDays(-30));
        AddRefund(dbContext, saleB.Id, clientB.Id, new DateOnly(2026, 5, 5), 50m, headCoach.Id, now);

        AddSale(dbContext, clientC.Id, new DateOnly(2026, 5, 15), 0m, headCoach.Id, now);

        var saleD = AddSale(dbContext, clientD.Id, new DateOnly(2026, 5, 12), 120m, headCoach.Id, now);
        AddRefund(dbContext, saleD.Id, clientD.Id, new DateOnly(2026, 5, 13), 40m, headCoach.Id, now, canceledByUserId: headCoach.Id);

        var saleE = AddSale(dbContext, clientE.Id, new DateOnly(2026, 5, 14), 300m, headCoach.Id, now);
        AddRefund(dbContext, saleE.Id, clientE.Id, new DateOnly(2026, 5, 15), 30m, headCoach.Id, now);
        AddRefund(dbContext, saleE.Id, clientE.Id, new DateOnly(2026, 5, 16), 20m, headCoach.Id, now);

        var saleF = AddSale(dbContext, clientF.Id, new DateOnly(2026, 5, 17), 70m, headCoach.Id, now);
        AddRefund(dbContext, saleF.Id, clientF.Id, new DateOnly(2026, 5, 18), 70m, headCoach.Id, now);

        await dbContext.SaveChangesAsync();

        return new SeededReportData(
            headCoach.Login,
            administrator.Login,
            coachOne.Login,
            sharedPassword,
            headCoach.Id,
            administrator.Id,
            coachOne.Id,
            coachTwo.Id,
            branchA.Id,
            branchB.Id,
            groupA.Id,
            groupB.Id);
    }

    private static async Task<SeededDuplicatedAttributionData> SeedDuplicatedTrainerAttributionDataAsync(FinancialReportsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = new DateTimeOffset(2026, 5, 14, 12, 0, 0, TimeSpan.Zero);
        var sharedPassword = "financial-reports-password";
        var headCoach = CreateUser("headcoach-dup-reports", "Главный тренер Dup Reports", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var coachOne = CreateUser("coach-one-dup-reports", "Тренер Dup 1", UserRole.Coach, sharedPassword, now, passwordHashService);
        var coachTwo = CreateUser("coach-two-dup-reports", "Тренер Dup 2", UserRole.Coach, sharedPassword, now, passwordHashService);

        var branch = CreateBranch("Dup Branch", now);
        var hall = CreateHall(branch.Id, "Dup Hall", now);
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Dup Group Type",
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupA = CreateGroup(branch.Id, hall.Id, groupType.Id, "Dup Group A", now);
        var groupB = CreateGroup(branch.Id, hall.Id, groupType.Id, "Dup Group B", now);
        var client = CreateClient(branch.Id, "Dup", now);

        dbContext.Users.AddRange(headCoach, coachOne, coachTwo);
        dbContext.Branches.Add(branch);
        dbContext.Halls.Add(hall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(groupA, groupB);
        dbContext.Clients.Add(client);

        AddClientBranchPeriod(dbContext, client.Id, branch.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, client.Id, groupA.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddClientGroupPeriod(dbContext, client.Id, groupB.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddGroupTrainerPeriod(dbContext, groupA.Id, coachOne.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddGroupTrainerPeriod(dbContext, groupB.Id, coachOne.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddGroupTrainerPeriod(dbContext, groupB.Id, coachTwo.Id, new DateOnly(2026, 1, 1), null, headCoach.Id, now);
        AddSale(dbContext, client.Id, new DateOnly(2026, 5, 10), 100m, headCoach.Id, now);

        await dbContext.SaveChangesAsync();

        return new SeededDuplicatedAttributionData(
            headCoach.Login,
            sharedPassword,
            coachOne.Id);
    }

    private static User CreateUser(
        string login,
        string fullName,
        UserRole role,
        string password,
        DateTimeOffset now,
        IPasswordHashService passwordHashService)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = role,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, password);
        return user;
    }

    private static Branch CreateBranch(string name, DateTimeOffset now)
    {
        return new Branch
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static Hall CreateHall(Guid branchId, string name, DateTimeOffset now)
    {
        return new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
            Name = name,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static TrainingGroup CreateGroup(
        Guid branchId,
        Guid hallId,
        Guid groupTypeId,
        string name,
        DateTimeOffset now)
    {
        return new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
            HallId = hallId,
            GroupTypeId = groupTypeId,
            Name = name,
            TrainingStartTime = new TimeOnly(18, 0),
            DurationMinutes = 60,
            Weekdays = [1, 3],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static Client CreateClient(Guid branchId, string suffix, DateTimeOffset now)
    {
        return new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
            LastName = $"Report{suffix}",
            FirstName = "Client",
            Phone = $"+79990000{suffix}",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static ClientMembershipSale AddSale(
        GymCrmDbContext dbContext,
        Guid clientId,
        DateOnly purchaseDate,
        decimal grossAmount,
        Guid createdByUserId,
        DateTimeOffset createdAt)
    {
        var sale = new ClientMembershipSale
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BehaviorKind = MembershipBehaviorKind.Term,
            PurchaseDate = purchaseDate,
            PaymentDate = purchaseDate,
            GrossAmount = grossAmount,
            CreatedByUserId = createdByUserId,
            CreatedAt = createdAt
        };

        dbContext.ClientMembershipSales.Add(sale);
        return sale;
    }

    private static void AddRefund(
        GymCrmDbContext dbContext,
        Guid saleId,
        Guid clientId,
        DateOnly refundDate,
        decimal amount,
        Guid createdByUserId,
        DateTimeOffset createdAt,
        Guid? canceledByUserId = null)
    {
        dbContext.ClientMembershipRefunds.Add(new ClientMembershipRefund
        {
            Id = Guid.NewGuid(),
            SaleId = saleId,
            ClientId = clientId,
            RefundDate = refundDate,
            Amount = amount,
            CreatedByUserId = createdByUserId,
            CreatedAt = createdAt,
            CanceledAt = canceledByUserId.HasValue ? createdAt.AddHours(1) : null,
            CanceledByUserId = canceledByUserId
        });
    }

    private static void AddTechnicalMembershipVersions(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid saleId,
        Guid changedByUserId,
        DateTimeOffset now)
    {
        dbContext.ClientMemberships.AddRange(
            new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                SaleId = saleId,
                BehaviorKind = MembershipBehaviorKind.Term,
                IndividualValidFrom = new DateOnly(2026, 5, 10),
                SingleVisitUsed = false,
                ValidFrom = now.AddMinutes(-10),
                ValidTo = now.AddMinutes(-5),
                ChangeReason = ClientMembershipChangeReason.NewPurchase,
                ChangedByUserId = changedByUserId,
                CreatedAt = now.AddMinutes(-10)
            },
            new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                SaleId = saleId,
                BehaviorKind = MembershipBehaviorKind.Term,
                IndividualValidFrom = new DateOnly(2026, 5, 10),
                SingleVisitUsed = false,
                ValidFrom = now.AddMinutes(-5),
                ValidTo = null,
                ChangeReason = ClientMembershipChangeReason.Correction,
                ChangedByUserId = changedByUserId,
                CreatedAt = now.AddMinutes(-5)
            });
    }

    private static void AddClientBranchPeriod(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid branchId,
        DateOnly validFrom,
        DateOnly? validTo,
        Guid createdByUserId,
        DateTimeOffset now)
    {
        dbContext.ClientBranchAssignments.Add(new ClientBranchAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BranchId = branchId,
            ValidFrom = validFrom,
            ValidTo = validTo,
            CreatedByUserId = createdByUserId,
            CreatedAt = now
        });
    }

    private static void AddClientGroupPeriod(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid groupId,
        DateOnly validFrom,
        DateOnly? validTo,
        Guid createdByUserId,
        DateTimeOffset now)
    {
        dbContext.ClientGroupAssignments.Add(new ClientGroupAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            GroupId = groupId,
            ValidFrom = validFrom,
            ValidTo = validTo,
            CreatedByUserId = createdByUserId,
            CreatedAt = now
        });
    }

    private static void AddGroupTrainerPeriod(
        GymCrmDbContext dbContext,
        Guid groupId,
        Guid trainerId,
        DateOnly validFrom,
        DateOnly? validTo,
        Guid createdByUserId,
        DateTimeOffset now)
    {
        dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TrainerId = trainerId,
            ValidFrom = validFrom,
            ValidTo = validTo,
            CreatedByUserId = createdByUserId,
            CreatedAt = now
        });
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        var initialSession = await GetSessionAsync(client);

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, password),
            initialSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        return await ReadJsonAsync<SessionPayload>(loginResponse);
    }

    private static async Task<SessionPayload> GetSessionAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/auth/session");
        return await ReadJsonAsync<SessionPayload>(response);
    }

    private static async Task<HttpResponseMessage> PostJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static void AssertPeriod(
        JsonElement payload,
        string preset,
        string? anchorDate,
        string from,
        string to)
    {
        var period = payload.GetProperty("period");
        Assert.Equal(preset, period.GetProperty("preset").GetString());
        Assert.Equal(from, period.GetProperty("from").GetString());
        Assert.Equal(to, period.GetProperty("to").GetString());
        if (anchorDate is null)
        {
            Assert.Equal(JsonValueKind.Null, period.GetProperty("anchorDate").ValueKind);
        }
        else
        {
            Assert.Equal(anchorDate, period.GetProperty("anchorDate").GetString());
        }
    }

    private static JsonElement FindRow(JsonElement rows, string idProperty, Guid id)
    {
        return rows
            .EnumerateArray()
            .Single(row => row.GetProperty(idProperty).GetString() == id.ToString());
    }

    private static void AssertTotals(
        JsonElement payload,
        int soldMembershipCount,
        decimal grossSales,
        decimal refundTotal,
        decimal netTotal,
        int newClientsCount)
    {
        Assert.Equal(soldMembershipCount, payload.GetProperty("soldMembershipCount").GetInt32());
        Assert.Equal(grossSales, payload.GetProperty("grossSales").GetDecimal());
        Assert.Equal(refundTotal, payload.GetProperty("refundTotal").GetDecimal());
        Assert.Equal(netTotal, payload.GetProperty("netTotal").GetDecimal());
        Assert.Equal(newClientsCount, payload.GetProperty("newClientsCount").GetInt32());
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Role);

    private sealed record SeededReportData(
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachOneLogin,
        string SharedPassword,
        Guid HeadCoachId,
        Guid AdministratorId,
        Guid CoachOneId,
        Guid CoachTwoId,
        Guid BranchAId,
        Guid BranchBId,
        Guid GroupAId,
        Guid GroupBId);

    private sealed record SeededDuplicatedAttributionData(
        string HeadCoachLogin,
        string SharedPassword,
        Guid CoachOneId);

    private sealed class FinancialReportsAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-reports",
                    ["BootstrapUser:FullName"] = "Bootstrap Reports"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-financial-reports-tests-{Guid.NewGuid():N}";
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
            });
        }
    }
}
