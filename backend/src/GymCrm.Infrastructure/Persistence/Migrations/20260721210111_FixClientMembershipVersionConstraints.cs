using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixClientMembershipVersionConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ClientMemberships"
                DROP CONSTRAINT "EX_ClientMemberships_ClientId_Period_NoOverlap";
                """);

            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships");

            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships",
                column: "SaleId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.Sql("""
                ALTER TABLE "ClientMemberships"
                ADD CONSTRAINT "EX_ClientMemberships_ClientId_Period_NoOverlap"
                EXCLUDE USING gist (
                    "ClientId" WITH =,
                    daterange("IndividualValidFrom", COALESCE("IndividualValidTo", 'infinity'::date), '[]') WITH &&
                ) WHERE ("ValidTo" IS NULL AND "BehaviorKind" IN ('Term', 'Professional'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ClientMemberships"
                DROP CONSTRAINT "EX_ClientMemberships_ClientId_Period_NoOverlap";
                """);

            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships");

            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships",
                column: "ClientId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships",
                column: "SaleId");

            migrationBuilder.Sql("""
                ALTER TABLE "ClientMemberships"
                ADD CONSTRAINT "EX_ClientMemberships_ClientId_Period_NoOverlap"
                EXCLUDE USING gist (
                    "ClientId" WITH =,
                    daterange("IndividualValidFrom", COALESCE("IndividualValidTo", 'infinity'::date), '[]') WITH &&
                ) WHERE ("BehaviorKind" IN ('Term', 'Professional'));
                """);
        }
    }
}
