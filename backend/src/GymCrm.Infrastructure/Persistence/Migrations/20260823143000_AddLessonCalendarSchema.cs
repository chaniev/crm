using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonCalendarSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LessonSeries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonSeries", x => x.Id);
                    table.CheckConstraint("CK_LessonSeries_DateRange", "\"EndsOn\" IS NULL OR \"EndsOn\" >= \"StartsOn\"");
                    table.ForeignKey(
                        name: "FK_LessonSeries_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LessonScheduleRuleVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonSeriesId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonScheduleRuleVersions", x => x.Id);
                    table.CheckConstraint("CK_LessonScheduleRuleVersions_DateRange", "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");
                    table.ForeignKey(
                        name: "FK_LessonScheduleRuleVersions_LessonSeries_LessonSeriesId",
                        column: x => x.LessonSeriesId,
                        principalTable: "LessonSeries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LessonOccurrences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceLessonSeriesId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceRuleVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceSlotId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceSlotLineageId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProjectedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SourceKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonOccurrences", x => x.Id);
                    table.CheckConstraint("CK_LessonOccurrences_DurationMinutes", "\"DurationMinutes\" >= 1 AND \"DurationMinutes\" <= 180");
                    table.ForeignKey(
                        name: "FK_LessonOccurrences_Halls_HallId",
                        column: x => x.HallId,
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrences_LessonScheduleRuleVersions_SourceRuleV~",
                        column: x => x.SourceRuleVersionId,
                        principalTable: "LessonScheduleRuleVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrences_LessonSeries_SourceLessonSeriesId",
                        column: x => x.SourceLessonSeriesId,
                        principalTable: "LessonSeries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrences_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LessonScheduleSlots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonScheduleRuleVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotLineageId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsoWeekday = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonScheduleSlots", x => x.Id);
                    table.CheckConstraint("CK_LessonScheduleSlots_DurationMinutes", "\"DurationMinutes\" >= 1 AND \"DurationMinutes\" <= 180");
                    table.CheckConstraint("CK_LessonScheduleSlots_IsoWeekday", "\"IsoWeekday\" >= 1 AND \"IsoWeekday\" <= 7");
                    table.ForeignKey(
                        name: "FK_LessonScheduleSlots_Halls_HallId",
                        column: x => x.HallId,
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonScheduleSlots_LessonScheduleRuleVersions_LessonSc~",
                        column: x => x.LessonScheduleRuleVersionId,
                        principalTable: "LessonScheduleRuleVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_GroupId_LessonDate_StartTime",
                table: "LessonOccurrences",
                columns: new[] { "GroupId", "LessonDate", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_HallId",
                table: "LessonOccurrences",
                column: "HallId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_Id_LessonDate",
                table: "LessonOccurrences",
                columns: new[] { "Id", "LessonDate" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_SourceLessonSeriesId",
                table: "LessonOccurrences",
                column: "SourceLessonSeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_SourceRuleVersionId",
                table: "LessonOccurrences",
                column: "SourceRuleVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_SourceSlotId",
                table: "LessonOccurrences",
                column: "SourceSlotId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrences_SourceSlotLineageId",
                table: "LessonOccurrences",
                column: "SourceSlotLineageId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonScheduleRuleVersions_LessonSeriesId_EffectiveFr~",
                table: "LessonScheduleRuleVersions",
                columns: new[] { "LessonSeriesId", "EffectiveFrom", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonScheduleRuleVersions_LessonSeriesId_VersionNumber",
                table: "LessonScheduleRuleVersions",
                columns: new[] { "LessonSeriesId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonScheduleSlots_HallId",
                table: "LessonScheduleSlots",
                column: "HallId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonScheduleSlots_LessonScheduleRuleVersionId_IsoWe~",
                table: "LessonScheduleSlots",
                columns: new[] { "LessonScheduleRuleVersionId", "IsoWeekday", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonScheduleSlots_LessonScheduleRuleVersionId_SlotL~",
                table: "LessonScheduleSlots",
                columns: new[] { "LessonScheduleRuleVersionId", "SlotLineageId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonSeries_GroupId",
                table: "LessonSeries",
                column: "GroupId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonSeries_StartsOn_EndsOn",
                table: "LessonSeries",
                columns: new[] { "StartsOn", "EndsOn" });

            migrationBuilder.AddForeignKey(
                name: "FK_LessonOccurrences_LessonScheduleSlots_SourceSlotId",
                table: "LessonOccurrences",
                column: "SourceSlotId",
                principalTable: "LessonScheduleSlots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "LessonOccurrences");
            migrationBuilder.DropTable(name: "LessonScheduleSlots");
            migrationBuilder.DropTable(name: "LessonScheduleRuleVersions");
            migrationBuilder.DropTable(name: "LessonSeries");
        }
    }
}
