using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(GymCrmDbContext))]
    [Migration("20260823163000_RequireAttendanceOccurrenceIdentity")]
    public partial class RequireAttendanceOccurrenceIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "Attendance" WHERE "LessonOccurrenceId" IS NULL) THEN
                        RAISE EXCEPTION 'attendance-transition-unresolved: LessonOccurrenceId contains NULL rows';
                    END IF;
                    IF EXISTS (SELECT 1 FROM "TrainingGroups")
                       AND NOT EXISTS (
                           SELECT 1
                           FROM "AttendanceTransitionRuns"
                           WHERE "Status" = 'ReadyForActivation' OR "Status" = 'Activated'
                       ) THEN
                        RAISE EXCEPTION 'attendance-transition-unresolved: training groups require a ready transition run';
                    END IF;
                    IF EXISTS (
                        SELECT 1
                        FROM "AttendanceTransitionRuns"
                        WHERE "Status" <> 'ReadyForActivation' AND "Status" <> 'Activated'
                    ) THEN
                        RAISE EXCEPTION 'attendance-transition-unresolved: transition run is not ready for activation';
                    END IF;
                    IF EXISTS (
                        SELECT 1
                        FROM "AttendanceTransitionReportItems"
                        WHERE "ResolutionStatus" = 'Unresolved'
                    ) THEN
                        RAISE EXCEPTION 'attendance-transition-unresolved: report contains unresolved items';
                    END IF;
                    IF EXISTS (
                        SELECT 1
                        FROM "AttendanceTransitionReportItems" report
                        WHERE jsonb_array_length(report."AttendanceRowIdsJson") <> (
                            SELECT count(DISTINCT resolution."AttendanceRowId")
                            FROM "AttendanceTransitionRowResolutions" resolution
                            WHERE resolution."ReportItemId" = report."Id"
                        )
                    ) THEN
                        RAISE EXCEPTION 'attendance-transition-unresolved: report row mapping is incomplete';
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "LessonOccurrenceId",
                table: "Attendance",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropIndex(
                name: "IX_Attendance_ClientId_GroupId_TrainingDate",
                table: "Attendance");

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_ClientId_LessonOccurrenceId",
                table: "Attendance",
                columns: new[] { "ClientId", "LessonOccurrenceId" },
                unique: true);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Attendance_ClientId_LessonOccurrenceId",
                table: "Attendance");

            migrationBuilder.AlterColumn<Guid>(
                name: "LessonOccurrenceId",
                table: "Attendance",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_ClientId_GroupId_TrainingDate",
                table: "Attendance",
                columns: new[] { "ClientId", "GroupId", "TrainingDate" },
                unique: true);
        }
    }
}
