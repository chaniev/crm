using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupTrainerSubstitutionPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GroupTrainerSubstitutionPeriods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubstituteTrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTrainerSubstitutionPeriods", x => x.Id);
                    table.CheckConstraint("CK_GroupTrainerSubstitutionPeriods_Period_Inclusive", "\"EndsOn\" >= \"StartsOn\"");
                    table.ForeignKey(
                        name: "FK_GroupTrainerSubstitutionPeriods_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupTrainerSubstitutionPeriods_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupTrainerSubstitutionPeriods_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupTrainerSubstitutionPeriods_Users_SubstituteTrainerId",
                        column: x => x.SubstituteTrainerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerSubstitutionPeriods_CancelledByUserId",
                table: "GroupTrainerSubstitutionPeriods",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerSubstitutionPeriods_CreatedByUserId",
                table: "GroupTrainerSubstitutionPeriods",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerSubstitutionPeriods_GroupId",
                table: "GroupTrainerSubstitutionPeriods",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerSubstitutionPeriods_GroupId_SubstituteTrainerId~",
                table: "GroupTrainerSubstitutionPeriods",
                columns: new[] { "GroupId", "SubstituteTrainerId", "StartsOn", "EndsOn" });

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerSubstitutionPeriods_SubstituteTrainerId",
                table: "GroupTrainerSubstitutionPeriods",
                column: "SubstituteTrainerId");

            migrationBuilder.Sql("""
                ALTER TABLE "GroupTrainerSubstitutionPeriods"
                ADD CONSTRAINT "EX_GroupTrainerSubstitutionPeriods_Pair_NoOverlap"
                EXCLUDE USING gist (
                    "GroupId" WITH =,
                    "SubstituteTrainerId" WITH =,
                    daterange("StartsOn", "EndsOn", '[]') WITH &&
                ) WHERE ("CancelledAt" IS NULL)
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupTrainerSubstitutionPeriods");
        }
    }
}
