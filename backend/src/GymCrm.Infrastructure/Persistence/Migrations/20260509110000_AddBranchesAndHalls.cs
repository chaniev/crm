using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchesAndHalls : Migration
    {
        private static readonly Guid DefaultBranchId = new("10000000-0000-0000-0000-000000000031");
        private static readonly Guid DefaultHallId = new("20000000-0000-0000-0000-000000000031");
        private static readonly DateTimeOffset DefaultCreatedAt = new(2026, 5, 9, 0, 0, 0, TimeSpan.Zero);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Branches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Halls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Halls", x => x.Id);
                    table.UniqueConstraint("AK_Halls_Id_BranchId", x => new { x.Id, x.BranchId });
                    table.ForeignKey(
                        name: "FK_Halls_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql($"""
                INSERT INTO "Branches" ("Id", "Name", "Address", "Description", "IsArchived", "CreatedAt", "UpdatedAt")
                SELECT
                    '{DefaultBranchId}'::uuid,
                    'Основной филиал',
                    NULL,
                    'Создан миграцией для существующих данных.',
                    FALSE,
                    '{DefaultCreatedAt:O}'::timestamp with time zone,
                    '{DefaultCreatedAt:O}'::timestamp with time zone
                WHERE (
                    EXISTS (SELECT 1 FROM "Clients")
                    OR EXISTS (SELECT 1 FROM "TrainingGroups")
                )
                AND NOT EXISTS (SELECT 1 FROM "Branches" WHERE "Id" = '{DefaultBranchId}'::uuid);
                """);

            migrationBuilder.Sql($"""
                INSERT INTO "Halls" ("Id", "BranchId", "Name", "Description", "IsArchived", "CreatedAt", "UpdatedAt")
                SELECT
                    '{DefaultHallId}'::uuid,
                    '{DefaultBranchId}'::uuid,
                    'Основной зал',
                    'Создан миграцией для существующих групп.',
                    FALSE,
                    '{DefaultCreatedAt:O}'::timestamp with time zone,
                    '{DefaultCreatedAt:O}'::timestamp with time zone
                WHERE EXISTS (SELECT 1 FROM "TrainingGroups")
                AND NOT EXISTS (SELECT 1 FROM "Halls" WHERE "Id" = '{DefaultHallId}'::uuid);
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "TrainingGroups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "HallId",
                table: "TrainingGroups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "Clients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "ClientGroups",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql($"""
                UPDATE "TrainingGroups"
                SET "BranchId" = '{DefaultBranchId}'::uuid,
                    "HallId" = '{DefaultHallId}'::uuid
                WHERE "BranchId" IS NULL OR "HallId" IS NULL;
                """);

            migrationBuilder.Sql($"""
                UPDATE "Clients"
                SET "BranchId" = '{DefaultBranchId}'::uuid
                WHERE "BranchId" IS NULL;
                """);

            migrationBuilder.Sql($"""
                UPDATE "ClientGroups"
                SET "BranchId" = '{DefaultBranchId}'::uuid
                WHERE "BranchId" IS NULL;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "TrainingGroups",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "HallId",
                table: "TrainingGroups",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "Clients",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "ClientGroups",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_ClientGroups_TrainingGroups_GroupId",
                table: "ClientGroups");

            migrationBuilder.DropIndex(
                name: "IX_ClientGroups_GroupId",
                table: "ClientGroups");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_TrainingGroups_Id_BranchId",
                table: "TrainingGroups",
                columns: new[] { "Id", "BranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_Branches_IsArchived",
                table: "Branches",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_Name",
                table: "Branches",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroups_BranchId",
                table: "ClientGroups",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroups_GroupId_BranchId",
                table: "ClientGroups",
                columns: new[] { "GroupId", "BranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_Clients_BranchId",
                table: "Clients",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Halls_BranchId",
                table: "Halls",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Halls_IsArchived",
                table: "Halls",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_Halls_Name",
                table: "Halls",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_BranchId",
                table: "TrainingGroups",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_HallId",
                table: "TrainingGroups",
                column: "HallId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_HallId_BranchId",
                table: "TrainingGroups",
                columns: new[] { "HallId", "BranchId" });

            migrationBuilder.AddForeignKey(
                name: "FK_ClientGroups_TrainingGroups_GroupId_BranchId",
                table: "ClientGroups",
                columns: new[] { "GroupId", "BranchId" },
                principalTable: "TrainingGroups",
                principalColumns: new[] { "Id", "BranchId" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Clients_Branches_BranchId",
                table: "Clients",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingGroups_Branches_BranchId",
                table: "TrainingGroups",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingGroups_Halls_HallId_BranchId",
                table: "TrainingGroups",
                columns: new[] { "HallId", "BranchId" },
                principalTable: "Halls",
                principalColumns: new[] { "Id", "BranchId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClientGroups_TrainingGroups_GroupId_BranchId",
                table: "ClientGroups");

            migrationBuilder.DropForeignKey(
                name: "FK_Clients_Branches_BranchId",
                table: "Clients");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingGroups_Branches_BranchId",
                table: "TrainingGroups");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingGroups_Halls_HallId_BranchId",
                table: "TrainingGroups");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_TrainingGroups_Id_BranchId",
                table: "TrainingGroups");

            migrationBuilder.DropIndex(
                name: "IX_ClientGroups_BranchId",
                table: "ClientGroups");

            migrationBuilder.DropIndex(
                name: "IX_ClientGroups_GroupId_BranchId",
                table: "ClientGroups");

            migrationBuilder.DropIndex(
                name: "IX_Clients_BranchId",
                table: "Clients");

            migrationBuilder.DropIndex(
                name: "IX_TrainingGroups_BranchId",
                table: "TrainingGroups");

            migrationBuilder.DropIndex(
                name: "IX_TrainingGroups_HallId",
                table: "TrainingGroups");

            migrationBuilder.DropIndex(
                name: "IX_TrainingGroups_HallId_BranchId",
                table: "TrainingGroups");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "TrainingGroups");

            migrationBuilder.DropColumn(
                name: "HallId",
                table: "TrainingGroups");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "ClientGroups");

            migrationBuilder.DropTable(
                name: "Halls");

            migrationBuilder.DropTable(
                name: "Branches");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroups_GroupId",
                table: "ClientGroups",
                column: "GroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_ClientGroups_TrainingGroups_GroupId",
                table: "ClientGroups",
                column: "GroupId",
                principalTable: "TrainingGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
