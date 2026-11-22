using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StaffPasswordReset : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CredentialVersion",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PasswordResetPending",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_PasswordResetPending",
                table: "Users",
                sql: "NOT \"PasswordResetPending\" OR (\"MustChangePassword\" AND \"CredentialVersion\" IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                LOCK TABLE "Users" IN ACCESS EXCLUSIVE MODE;
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "Users" WHERE "CredentialVersion" IS NOT NULL) THEN
                        RAISE EXCEPTION 'password-reset-downgrade-blocked: deployed credentials require a compatible backend';
                    END IF;
                END $$;
                """);
            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_PasswordResetPending",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CredentialVersion",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PasswordResetPending",
                table: "Users");
        }
    }
}
