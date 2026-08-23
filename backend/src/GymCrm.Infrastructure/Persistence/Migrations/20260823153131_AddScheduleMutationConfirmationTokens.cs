using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddScheduleMutationConfirmationTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScheduleMutationConfirmationTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Purpose = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleMutationConfirmationTokens", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleMutationConfirmationTokens_ActorUserId_Purpose_Expi~",
                table: "ScheduleMutationConfirmationTokens",
                columns: new[] { "ActorUserId", "Purpose", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleMutationConfirmationTokens_TokenHash",
                table: "ScheduleMutationConfirmationTokens",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScheduleMutationConfirmationTokens");
        }
    }
}
