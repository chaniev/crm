using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Replaces the case-sensitive login uniqueness with the case-insensitive
    /// normalized-key barrier. The guard runs before any contract change: it
    /// stops when rows were never backfilled by the application startup flow
    /// and when backfilled keys collide (for example stored
    /// <c>Coach</c>/<c>coach</c>), naming the conflicting canonical logins.
    /// </summary>
    [DbContext(typeof(GymCrmDbContext))]
    [Migration("20260901120001_RequireCaseInsensitiveLoginIdentity")]
    public partial class RequireCaseInsensitiveLoginIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                DECLARE
                    missing_key_count integer;
                    collision_evidence text;
                BEGIN
                    SELECT count(*) INTO missing_key_count
                    FROM "Users" WHERE "LoginNormalized" IS NULL;

                    IF missing_key_count > 0 THEN
                        RAISE EXCEPTION
                            'case-insensitive-login-collision: % user rows have no normalized login key; run the application startup persistence flow to backfill the key before upgrading',
                            missing_key_count;
                    END IF;

                    SELECT string_agg(duplicated_logins, '; ') INTO collision_evidence
                    FROM (
                        SELECT string_agg("Login", '/' ORDER BY "Login") AS duplicated_logins
                        FROM "Users"
                        GROUP BY "LoginNormalized"
                        HAVING count(*) > 1
                    ) duplicated;

                    IF collision_evidence IS NOT NULL THEN
                        RAISE EXCEPTION
                            'case-insensitive-login-collision: cannot apply case-insensitive login uniqueness because existing users collide after normalization: %. Resolve these accounts before upgrading; the migration did not change any data.',
                            collision_evidence;
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "LoginNormalized",
                table: "Users",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldNullable: true);

            migrationBuilder.DropIndex(
                name: "IX_Users_Login",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "UX_Users_LoginNormalized",
                table: "Users",
                column: "LoginNormalized",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Users_LoginNormalized",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Login",
                table: "Users",
                column: "Login",
                unique: true);

            migrationBuilder.AlterColumn<string>(
                name: "LoginNormalized",
                table: "Users",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldNullable: false);
        }
    }
}
