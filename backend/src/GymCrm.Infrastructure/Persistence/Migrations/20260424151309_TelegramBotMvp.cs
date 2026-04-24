using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TelegramBotMvp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BotIdempotencyRecords_Platform_IdempotencyKey",
                table: "BotIdempotencyRecords");

            migrationBuilder.CreateIndex(
                name: "IX_BotIdempotencyRecords_Platform_PlatformUserIdHash_Idempoten~",
                table: "BotIdempotencyRecords",
                columns: new[] { "Platform", "PlatformUserIdHash", "IdempotencyKey", "ActionType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BotIdempotencyRecords_Platform_PlatformUserIdHash_Idempoten~",
                table: "BotIdempotencyRecords");

            migrationBuilder.CreateIndex(
                name: "IX_BotIdempotencyRecords_Platform_IdempotencyKey",
                table: "BotIdempotencyRecords",
                columns: new[] { "Platform", "IdempotencyKey" },
                unique: true);
        }
    }
}
