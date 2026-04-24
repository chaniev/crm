using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramBotMvpBackendFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MessengerPlatform",
                table: "Users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MessengerPlatformUserId",
                table: "Users",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MessengerPlatform",
                table: "AuditLogs",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MessengerPlatformUserIdHash",
                table: "AuditLogs",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "AuditLogs",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Web");

            migrationBuilder.CreateTable(
                name: "BotIdempotencyRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PlatformUserIdHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ActionType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ResponseJson = table.Column<string>(type: "jsonb", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BotIdempotencyRecords", x => x.Id);
                    table.CheckConstraint("CK_BotIdempotencyRecords_RequiredValues", "btrim(\"Platform\") <> '' AND btrim(\"PlatformUserIdHash\") <> '' AND btrim(\"IdempotencyKey\") <> '' AND btrim(\"ActionType\") <> '' AND btrim(\"PayloadHash\") <> '' AND btrim(\"Status\") <> ''");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_MessengerPlatform_MessengerPlatformUserId",
                table: "Users",
                columns: new[] { "MessengerPlatform", "MessengerPlatformUserId" },
                unique: true,
                filter: "\"MessengerPlatform\" IS NOT NULL AND \"MessengerPlatformUserId\" IS NOT NULL AND btrim(\"MessengerPlatformUserId\") <> ''");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_MessengerIdentity_Consistency",
                table: "Users",
                sql: "(\"MessengerPlatform\" IS NULL AND (\"MessengerPlatformUserId\" IS NULL OR btrim(\"MessengerPlatformUserId\") = '')) OR (\"MessengerPlatform\" = 'Telegram' AND \"MessengerPlatformUserId\" IS NOT NULL AND btrim(\"MessengerPlatformUserId\") <> '')");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_MessengerPlatform",
                table: "AuditLogs",
                column: "MessengerPlatform");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Source",
                table: "AuditLogs",
                column: "Source");

            migrationBuilder.CreateIndex(
                name: "IX_BotIdempotencyRecords_ExpiresAt",
                table: "BotIdempotencyRecords",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_BotIdempotencyRecords_Platform_IdempotencyKey",
                table: "BotIdempotencyRecords",
                columns: new[] { "Platform", "IdempotencyKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BotIdempotencyRecords");

            migrationBuilder.DropIndex(
                name: "IX_Users_MessengerPlatform_MessengerPlatformUserId",
                table: "Users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_MessengerIdentity_Consistency",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_MessengerPlatform",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_Source",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "MessengerPlatform",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MessengerPlatformUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MessengerPlatform",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "MessengerPlatformUserIdHash",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "AuditLogs");
        }
    }
}
