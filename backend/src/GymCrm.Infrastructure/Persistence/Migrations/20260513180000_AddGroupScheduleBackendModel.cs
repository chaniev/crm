using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupScheduleBackendModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DurationMinutes",
                table: "TrainingGroups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int[]>(
                name: "Weekdays",
                table: "TrainingGroups",
                type: "integer[]",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "TrainingGroups"
                SET "DurationMinutes" = COALESCE("DurationMinutes", 60),
                    "Weekdays" = COALESCE("Weekdays", ARRAY[1]::integer[])
                WHERE "DurationMinutes" IS NULL OR "Weekdays" IS NULL;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "DurationMinutes",
                table: "TrainingGroups",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int[]>(
                name: "Weekdays",
                table: "TrainingGroups",
                type: "integer[]",
                nullable: false,
                oldClrType: typeof(int[]),
                oldType: "integer[]",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "ScheduleText",
                table: "TrainingGroups");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TrainingGroups_DurationMinutes_Range",
                table: "TrainingGroups",
                sql: """
                "DurationMinutes" >= 1 AND "DurationMinutes" <= 180
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_TrainingGroups_Weekdays_NotEmpty",
                table: "TrainingGroups",
                sql: "cardinality(\"Weekdays\") >= 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_TrainingGroups_DurationMinutes_Range",
                table: "TrainingGroups");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TrainingGroups_Weekdays_NotEmpty",
                table: "TrainingGroups");

            migrationBuilder.AddColumn<string>(
                name: "ScheduleText",
                table: "TrainingGroups",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: string.Empty);

            migrationBuilder.DropColumn(
                name: "DurationMinutes",
                table: "TrainingGroups");

            migrationBuilder.DropColumn(
                name: "Weekdays",
                table: "TrainingGroups");
        }
    }
}
