using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonOccurrenceTrainerSubstitutions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LessonOccurrenceTrainerSubstitutions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonOccurrenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReplacedTrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubstituteTrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    SourceGroupTrainerSubstitutionId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonOccurrenceTrainerSubstitutions", x => x.Id);
                    table.CheckConstraint("CK_LessonOccurrenceTrainerSubstitutions_CancelledMetadata", "(\"CancelledAt\" IS NULL AND \"CancelledByUserId\" IS NULL) OR (\"CancelledAt\" IS NOT NULL AND \"CancelledByUserId\" IS NOT NULL)");
                    table.CheckConstraint("CK_LessonOccurrenceTrainerSubstitutions_DifferentTrainers", "\"ReplacedTrainerId\" <> \"SubstituteTrainerId\"");
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_GroupTrainerSubstituti~",
                        column: x => x.SourceGroupTrainerSubstitutionId,
                        principalTable: "GroupTrainerSubstitutions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_LessonOccurrences_Less~",
                        column: x => x.LessonOccurrenceId,
                        principalTable: "LessonOccurrences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_Users_ReplacedTrainerId",
                        column: x => x.ReplacedTrainerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_Users_SubstituteTraine~",
                        column: x => x.SubstituteTrainerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LessonOccurrenceTrainerSubstitutions_Users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_CancelledByUserId",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_CreatedByUserId",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_LessonOccurrenceId",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "LessonOccurrenceId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_LessonOccurrenceId_Rep~",
                table: "LessonOccurrenceTrainerSubstitutions",
                columns: new[] { "LessonOccurrenceId", "ReplacedTrainerId" },
                unique: true,
                filter: "\"CancelledAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_ReplacedTrainerId",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "ReplacedTrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_SourceGroupTrainerSub~1",
                table: "LessonOccurrenceTrainerSubstitutions",
                columns: new[] { "SourceGroupTrainerSubstitutionId", "LessonOccurrenceId" },
                unique: true,
                filter: "\"SourceGroupTrainerSubstitutionId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_SourceGroupTrainerSubs~",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "SourceGroupTrainerSubstitutionId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_SubstituteTrainerId",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "SubstituteTrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonOccurrenceTrainerSubstitutions_UpdatedByUserId",
                table: "LessonOccurrenceTrainerSubstitutions",
                column: "UpdatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LessonOccurrenceTrainerSubstitutions");
        }
    }
}
