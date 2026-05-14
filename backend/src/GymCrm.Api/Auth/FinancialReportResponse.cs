namespace GymCrm.Api.Auth;

internal sealed record FinancialReportResponse(
    FinancialReportPeriodResponse Period,
    FinancialReportTotalsResponse Totals,
    IReadOnlyList<FinancialReportBranchBreakdownResponse> BranchBreakdown,
    IReadOnlyList<FinancialReportGroupBreakdownResponse> GroupBreakdown,
    IReadOnlyList<FinancialReportTrainerBreakdownResponse> TrainerBreakdown);

internal sealed record FinancialReportPeriodResponse(
    string Preset,
    DateOnly? AnchorDate,
    DateOnly From,
    DateOnly To);

internal sealed record FinancialReportTotalsResponse(
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);

internal sealed record FinancialReportBranchBreakdownResponse(
    Guid BranchId,
    string BranchName,
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);

internal sealed record FinancialReportGroupBreakdownResponse(
    Guid GroupId,
    string GroupName,
    Guid BranchId,
    string BranchName,
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);

internal sealed record FinancialReportTrainerBreakdownResponse(
    Guid TrainerId,
    string TrainerName,
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);
