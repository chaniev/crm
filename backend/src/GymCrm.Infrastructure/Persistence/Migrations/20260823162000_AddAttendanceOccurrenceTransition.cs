using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(GymCrmDbContext))]
    [Migration("20260823162000_AddAttendanceOccurrenceTransition")]
    public partial class AddAttendanceOccurrenceTransition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LessonOccurrenceId",
                table: "Attendance",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_LessonOccurrenceId",
                table: "Attendance",
                column: "LessonOccurrenceId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attendance_LessonOccurrences_LessonOccurrenceId",
                table: "Attendance",
                column: "LessonOccurrenceId",
                principalTable: "LessonOccurrences",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.CreateTable(
                name: "AttendanceTransitionRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CutoverDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SourceSchemaVersion = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceTransitionRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AttendanceTransitionReportItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    TrainingDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AttendanceRowIdsJson = table.Column<string>(type: "jsonb", nullable: false),
                    RowCount = table.Column<int>(type: "integer", nullable: false),
                    ReasonCode = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    ResolutionStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ResolutionKind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    TargetLessonOccurrenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    OperatorComment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceTransitionReportItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttendanceTransitionReportItems_AttendanceTransitionRuns_Ru~",
                        column: x => x.RunId,
                        principalTable: "AttendanceTransitionRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionReportItems_GroupId_TrainingDate",
                table: "AttendanceTransitionReportItems",
                columns: new[] { "GroupId", "TrainingDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionReportItems_RunId_ResolutionStatus",
                table: "AttendanceTransitionReportItems",
                columns: new[] { "RunId", "ResolutionStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionReportItems_TargetLessonOccurrenceId",
                table: "AttendanceTransitionReportItems",
                column: "TargetLessonOccurrenceId");

            migrationBuilder.CreateTable(
                name: "AttendanceTransitionRowResolutions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttendanceRowId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetLessonOccurrenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResolutionKind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    OperatorComment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ResolutionDigest = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceTransitionRowResolutions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttendanceTransitionRowResolutions_Attendance_AttendanceR~",
                        column: x => x.AttendanceRowId,
                        principalTable: "Attendance",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AttendanceTransitionRowResolutions_AttendanceTransitionRe~",
                        column: x => x.ReportItemId,
                        principalTable: "AttendanceTransitionReportItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttendanceTransitionRowResolutions_AttendanceTransitionRu~",
                        column: x => x.RunId,
                        principalTable: "AttendanceTransitionRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttendanceTransitionRowResolutions_LessonOccurrences_Targ~",
                        column: x => x.TargetLessonOccurrenceId,
                        principalTable: "LessonOccurrences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionRowResolutions_AttendanceRowId",
                table: "AttendanceTransitionRowResolutions",
                column: "AttendanceRowId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionRowResolutions_ReportItemId",
                table: "AttendanceTransitionRowResolutions",
                column: "ReportItemId");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionRowResolutions_RunId",
                table: "AttendanceTransitionRowResolutions",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionRowResolutions_TargetLessonOccurrence~",
                table: "AttendanceTransitionRowResolutions",
                column: "TargetLessonOccurrenceId");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionRuns_CutoverDate_Status",
                table: "AttendanceTransitionRuns",
                columns: new[] { "CutoverDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceTransitionRuns_SourceSchemaVersion",
                table: "AttendanceTransitionRuns",
                column: "SourceSchemaVersion",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AttendanceTransitionRowResolutions");
            migrationBuilder.DropTable(name: "AttendanceTransitionReportItems");
            migrationBuilder.DropTable(name: "AttendanceTransitionRuns");
            migrationBuilder.DropForeignKey(
                name: "FK_Attendance_LessonOccurrences_LessonOccurrenceId",
                table: "Attendance");
            migrationBuilder.DropIndex(
                name: "IX_Attendance_LessonOccurrenceId",
                table: "Attendance");
            migrationBuilder.DropColumn(name: "LessonOccurrenceId", table: "Attendance");
        }
    }
}
