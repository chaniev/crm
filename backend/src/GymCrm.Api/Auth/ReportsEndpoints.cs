using System.Globalization;
using GymCrm.Application.Reports;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(ReportsApiConstants.RoutePrefix)
            .RequireAuthorization();

        group.MapGet(ReportsApiConstants.FinancialRoute, GetFinancialReportAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewFinancialReports);

        return endpoints;
    }

    private static async Task<Results<Ok<FinancialReportResponse>, ValidationProblem>> GetFinancialReportAsync(
        string? periodPreset,
        string? anchorDate,
        string? from,
        string? to,
        string? branchId,
        string? trainerId,
        IFinancialReportService financialReportService,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var normalization = await NormalizeRequestAsync(
            periodPreset,
            anchorDate,
            from,
            to,
            branchId,
            trainerId,
            dbContext,
            cancellationToken);

        if (normalization.Errors.Count > 0 || normalization.Request is null)
        {
            return TypedResults.ValidationProblem(normalization.Errors);
        }

        var result = await financialReportService.GetFinancialReportAsync(
            new FinancialReportQuery(
                normalization.Request.From,
                normalization.Request.To,
                normalization.Request.BranchId,
                normalization.Request.TrainerId),
            cancellationToken);

        return TypedResults.Ok(MapResponse(normalization.Request, result));
    }

    private static async Task<ReportRequestNormalization> NormalizeRequestAsync(
        string? periodPreset,
        string? anchorDate,
        string? from,
        string? to,
        string? branchId,
        string? trainerId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var parsedPreset = ParsePreset(periodPreset, errors);
        var parsedAnchorDate = ParseOptionalDate(anchorDate, "anchorDate", errors);
        var parsedFrom = ParseOptionalDate(from, "from", errors);
        var parsedTo = ParseOptionalDate(to, "to", errors);
        var parsedBranchId = ParseOptionalGuid(branchId, "branchId", ReportsResources.BranchIdInvalid, errors);
        var parsedTrainerId = ParseOptionalGuid(trainerId, "trainerId", ReportsResources.TrainerIdInvalid, errors);

        if (parsedPreset.HasValue)
        {
            ValidatePeriodCombination(
                parsedPreset.Value,
                anchorDate,
                parsedAnchorDate,
                from,
                parsedFrom,
                to,
                parsedTo,
                errors);
        }

        if (parsedFrom.HasValue && parsedTo.HasValue && parsedFrom.Value > parsedTo.Value)
        {
            errors["to"] = [ReportsResources.ToCannotBeBeforeFrom];
        }

        if (errors.Count == 0)
        {
            await ValidateBranchAndTrainerAsync(
                parsedBranchId,
                parsedTrainerId,
                dbContext,
                errors,
                cancellationToken);
        }

        if (errors.Count > 0 || !parsedPreset.HasValue)
        {
            return new ReportRequestNormalization(null, errors);
        }

        var (normalizedFrom, normalizedTo) = ResolvePeriod(
            parsedPreset.Value,
            parsedAnchorDate,
            parsedFrom,
            parsedTo);

        return new ReportRequestNormalization(
            new NormalizedFinancialReportRequest(
                ToPresetName(parsedPreset.Value),
                normalizedFrom,
                normalizedTo,
                parsedAnchorDate,
                parsedBranchId,
                parsedTrainerId),
            errors);
    }

    private static FinancialReportPeriodPreset? ParsePreset(
        string? periodPreset,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(periodPreset))
        {
            errors["periodPreset"] = [ReportsResources.PeriodPresetRequired];
            return null;
        }

        return periodPreset.Trim().ToLowerInvariant() switch
        {
            "month" => FinancialReportPeriodPreset.Month,
            "quarter" => FinancialReportPeriodPreset.Quarter,
            "year" => FinancialReportPeriodPreset.Year,
            "custom" => FinancialReportPeriodPreset.Custom,
            _ => AddPresetError(errors)
        };
    }

    private static FinancialReportPeriodPreset? AddPresetError(Dictionary<string, string[]> errors)
    {
        errors["periodPreset"] = [ReportsResources.PeriodPresetInvalid];
        return null;
    }

    private static DateOnly? ParseOptionalDate(
        string? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParseExact(
                value.Trim(),
                ReportsApiConstants.DateFormat,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsedDate))
        {
            return parsedDate;
        }

        errors[key] = [ReportsResources.DateMustUseFormat(ReportsApiConstants.DateFormat)];
        return null;
    }

    private static Guid? ParseOptionalGuid(
        string? value,
        string key,
        string invalidMessage,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!Guid.TryParse(value.Trim(), out var parsed) || parsed == Guid.Empty)
        {
            errors[key] = [invalidMessage];
            return null;
        }

        return parsed;
    }

    private static void ValidatePeriodCombination(
        FinancialReportPeriodPreset preset,
        string? rawAnchorDate,
        DateOnly? parsedAnchorDate,
        string? rawFrom,
        DateOnly? parsedFrom,
        string? rawTo,
        DateOnly? parsedTo,
        Dictionary<string, string[]> errors)
    {
        if (preset == FinancialReportPeriodPreset.Custom)
        {
            if (!string.IsNullOrWhiteSpace(rawAnchorDate) && parsedAnchorDate.HasValue)
            {
                errors["anchorDate"] = [ReportsResources.AnchorDateNotAllowedForCustom];
            }

            if (string.IsNullOrWhiteSpace(rawFrom))
            {
                errors["from"] = [ReportsResources.FromRequiredForCustom];
            }

            if (string.IsNullOrWhiteSpace(rawTo))
            {
                errors["to"] = [ReportsResources.ToRequiredForCustom];
            }

            return;
        }

        if (string.IsNullOrWhiteSpace(rawAnchorDate))
        {
            errors["anchorDate"] = [ReportsResources.AnchorDateRequired];
        }

        if (!string.IsNullOrWhiteSpace(rawFrom) && parsedFrom.HasValue)
        {
            errors["from"] = [ReportsResources.FromNotAllowedForPreset];
        }

        if (!string.IsNullOrWhiteSpace(rawTo) && parsedTo.HasValue)
        {
            errors["to"] = [ReportsResources.ToNotAllowedForPreset];
        }
    }

    private static async Task ValidateBranchAndTrainerAsync(
        Guid? branchId,
        Guid? trainerId,
        GymCrmDbContext dbContext,
        Dictionary<string, string[]> errors,
        CancellationToken cancellationToken)
    {
        if (branchId.HasValue)
        {
            var branchExists = await dbContext.Branches
                .AsNoTracking()
                .AnyAsync(branch => branch.Id == branchId.Value, cancellationToken);

            if (!branchExists)
            {
                errors["branchId"] = [ReportsResources.BranchMustExist];
            }
        }

        if (trainerId.HasValue)
        {
            var trainer = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.Id == trainerId.Value)
                .Select(user => new
                {
                    user.Role
                })
                .SingleOrDefaultAsync(cancellationToken);

            if (trainer is null)
            {
                errors["trainerId"] = [ReportsResources.TrainerMustExist];
            }
            else if (!GroupTrainerEligibility.IsAssignableTrainerRole(trainer.Role))
            {
                errors["trainerId"] = [ReportsResources.TrainerMustBeCoach];
            }
        }
    }

    private static (DateOnly From, DateOnly To) ResolvePeriod(
        FinancialReportPeriodPreset preset,
        DateOnly? anchorDate,
        DateOnly? from,
        DateOnly? to)
    {
        return preset switch
        {
            FinancialReportPeriodPreset.Month => ResolveMonth(anchorDate!.Value),
            FinancialReportPeriodPreset.Quarter => ResolveQuarter(anchorDate!.Value),
            FinancialReportPeriodPreset.Year => ResolveYear(anchorDate!.Value),
            FinancialReportPeriodPreset.Custom => (from!.Value, to!.Value),
            _ => throw new InvalidOperationException($"Unsupported financial report period preset '{preset}'.")
        };
    }

    private static (DateOnly From, DateOnly To) ResolveMonth(DateOnly anchorDate)
    {
        var from = new DateOnly(anchorDate.Year, anchorDate.Month, 1);
        return (from, from.AddMonths(1).AddDays(-1));
    }

    private static (DateOnly From, DateOnly To) ResolveQuarter(DateOnly anchorDate)
    {
        var quarterStartMonth = ((anchorDate.Month - 1) / 3 * 3) + 1;
        var from = new DateOnly(anchorDate.Year, quarterStartMonth, 1);
        return (from, from.AddMonths(3).AddDays(-1));
    }

    private static (DateOnly From, DateOnly To) ResolveYear(DateOnly anchorDate)
    {
        return (new DateOnly(anchorDate.Year, 1, 1), new DateOnly(anchorDate.Year, 12, 31));
    }

    private static FinancialReportResponse MapResponse(
        NormalizedFinancialReportRequest request,
        FinancialReportResult result)
    {
        return new FinancialReportResponse(
            new FinancialReportPeriodResponse(
                request.PeriodPreset,
                request.AnchorDate,
                request.From,
                request.To),
            MapTotals(result.Totals),
            result.BranchBreakdown
                .Select(row => new FinancialReportBranchBreakdownResponse(
                    row.BranchId,
                    row.BranchName,
                    row.SoldMembershipCount,
                    row.GrossSales,
                    row.RefundTotal,
                    row.NetTotal,
                    row.NewClientsCount))
                .ToArray(),
            result.GroupBreakdown
                .Select(row => new FinancialReportGroupBreakdownResponse(
                    row.GroupId,
                    row.GroupName,
                    row.BranchId,
                    row.BranchName,
                    row.SoldMembershipCount,
                    row.GrossSales,
                    row.RefundTotal,
                    row.NetTotal,
                    row.NewClientsCount))
                .ToArray(),
            result.TrainerBreakdown
                .Select(row => new FinancialReportTrainerBreakdownResponse(
                    row.TrainerId,
                    row.TrainerName,
                    row.SoldMembershipCount,
                    row.GrossSales,
                    row.RefundTotal,
                    row.NetTotal,
                    row.NewClientsCount))
                .ToArray());
    }

    private static FinancialReportTotalsResponse MapTotals(FinancialReportTotals totals)
    {
        return new FinancialReportTotalsResponse(
            totals.SoldMembershipCount,
            totals.GrossSales,
            totals.RefundTotal,
            totals.NetTotal,
            totals.NewClientsCount);
    }

    private static string ToPresetName(FinancialReportPeriodPreset preset)
    {
        return preset switch
        {
            FinancialReportPeriodPreset.Month => "month",
            FinancialReportPeriodPreset.Quarter => "quarter",
            FinancialReportPeriodPreset.Year => "year",
            FinancialReportPeriodPreset.Custom => "custom",
            _ => throw new InvalidOperationException($"Unsupported financial report period preset '{preset}'.")
        };
    }

    private enum FinancialReportPeriodPreset
    {
        Month = 0,
        Quarter = 1,
        Year = 2,
        Custom = 3
    }

    private sealed record ReportRequestNormalization(
        NormalizedFinancialReportRequest? Request,
        Dictionary<string, string[]> Errors);

    private sealed record NormalizedFinancialReportRequest(
        string PeriodPreset,
        DateOnly From,
        DateOnly To,
        DateOnly? AnchorDate,
        Guid? BranchId,
        Guid? TrainerId);
}
