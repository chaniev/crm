using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupTypes : Migration
    {
        private static readonly Guid DefaultGroupTypeId = new("30000000-0000-0000-0000-000000000030");
        private static readonly DateTimeOffset DefaultCreatedAt = new(2026, 5, 13, 0, 0, 0, TimeSpan.Zero);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GroupTypeId",
                table: "TrainingGroups",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GroupTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SystemIdentifier = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTypes", x => x.Id);
                });

            migrationBuilder.Sql($"""
                INSERT INTO "GroupTypes" ("Id", "Name", "Description", "SystemIdentifier", "CreatedAt", "UpdatedAt")
                SELECT
                    '{DefaultGroupTypeId}'::uuid,
                    'Базовый тип группы',
                    'Создан миграцией для существующих групп.',
                    'default',
                    '{DefaultCreatedAt:O}'::timestamp with time zone,
                    '{DefaultCreatedAt:O}'::timestamp with time zone
                WHERE EXISTS (SELECT 1 FROM "TrainingGroups")
                AND NOT EXISTS (SELECT 1 FROM "GroupTypes" WHERE "Id" = '{DefaultGroupTypeId}'::uuid);
                """);

            migrationBuilder.Sql($"""
                UPDATE "TrainingGroups"
                SET "GroupTypeId" = '{DefaultGroupTypeId}'::uuid
                WHERE "GroupTypeId" IS NULL;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "GroupTypeId",
                table: "TrainingGroups",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_GroupTypeId",
                table: "TrainingGroups",
                column: "GroupTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTypes_Name",
                table: "GroupTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupTypes_SystemIdentifier",
                table: "GroupTypes",
                column: "SystemIdentifier",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingGroups_GroupTypes_GroupTypeId",
                table: "TrainingGroups",
                column: "GroupTypeId",
                principalTable: "GroupTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TrainingGroups_GroupTypes_GroupTypeId",
                table: "TrainingGroups");

            migrationBuilder.DropTable(
                name: "GroupTypes");

            migrationBuilder.DropIndex(
                name: "IX_TrainingGroups_GroupTypeId",
                table: "TrainingGroups");

            migrationBuilder.DropColumn(
                name: "GroupTypeId",
                table: "TrainingGroups");
        }
    }
}
