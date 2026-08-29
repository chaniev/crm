\set ON_ERROR_STOP on

BEGIN;

-- TASK-142 operational compatibility transition.
-- Requirements: none — this script restores the retained-database schema and
-- data shape already required by accepted REQ-SUB-006/008/009/010/011.
--
-- The target model was added to migrations that are already recorded as
-- applied on retained installations. EF Core therefore cannot create these
-- objects on an upgrade from 20260721210111. The script is intentionally
-- idempotent and aborts before changing data when legacy targets are ambiguous.

DO $validation$
DECLARE
    invalid_membership_count integer;
BEGIN
    WITH candidates AS (
        SELECT
            membership."Id" AS membership_id,
            membership."BehaviorKind" AS behavior_kind,
            count(DISTINCT assignment."GroupId") FILTER (WHERE assignment."ValidTo" IS NULL) AS group_count,
            count(DISTINCT group_row."BranchId") FILTER (WHERE assignment."ValidTo" IS NULL) AS branch_count
        FROM "ClientMemberships" membership
        LEFT JOIN "ClientGroupAssignments" assignment
            ON assignment."ClientId" = membership."ClientId"
        LEFT JOIN "TrainingGroups" group_row
            ON group_row."Id" = assignment."GroupId"
        GROUP BY membership."Id", membership."BehaviorKind"
    )
    SELECT count(*)
    INTO invalid_membership_count
    FROM candidates
    WHERE group_count < 1
       OR group_count > 5
       OR branch_count <> 1
       OR (behavior_kind = 'SingleVisit' AND group_count <> 1);

    IF invalid_membership_count > 0 THEN
        RAISE EXCEPTION
            'retained-membership-transition-ambiguous: % membership rows cannot be mapped to 1..5 active groups in one branch',
            invalid_membership_count;
    END IF;
END
$validation$;

CREATE TABLE IF NOT EXISTS "ClientMembershipTargetGroups" (
    "ClientMembershipId" uuid NOT NULL,
    "Position" integer NOT NULL,
    "GroupId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_ClientMembershipTargetGroups"
        PRIMARY KEY ("ClientMembershipId", "Position"),
    CONSTRAINT "CK_ClientMembershipTargetGroups_Position"
        CHECK ("Position" >= 0 AND "Position" <= 4),
    CONSTRAINT "FK_CMTG_ClientMemberships"
        FOREIGN KEY ("ClientMembershipId") REFERENCES "ClientMemberships" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CMTG_TrainingGroups"
        FOREIGN KEY ("GroupId") REFERENCES "TrainingGroups" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CMTG_Branches"
        FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_ClientMembershipTargetGroups_ClientMembershipId_GroupId"
    ON "ClientMembershipTargetGroups" ("ClientMembershipId", "GroupId");
CREATE INDEX IF NOT EXISTS "IX_ClientMembershipTargetGroups_GroupId"
    ON "ClientMembershipTargetGroups" ("GroupId");
CREATE INDEX IF NOT EXISTS "IX_ClientMembershipTargetGroups_BranchId"
    ON "ClientMembershipTargetGroups" ("BranchId");

CREATE TABLE IF NOT EXISTS "ClientMembershipSaleTargetSnapshots" (
    "SaleId" uuid NOT NULL,
    "Position" integer NOT NULL,
    "GroupId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Provenance" character varying(32) NOT NULL,
    CONSTRAINT "PK_ClientMembershipSaleTargetSnapshots"
        PRIMARY KEY ("SaleId", "Position"),
    CONSTRAINT "CK_ClientMembershipSaleTargetSnapshots_Position"
        CHECK ("Position" >= 0 AND "Position" <= 4),
    CONSTRAINT "FK_CMSTS_ClientMembershipSales"
        FOREIGN KEY ("SaleId") REFERENCES "ClientMembershipSales" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CMSTS_TrainingGroups"
        FOREIGN KEY ("GroupId") REFERENCES "TrainingGroups" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CMSTS_Branches"
        FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_ClientMembershipSaleTargetSnapshots_SaleId_GroupId"
    ON "ClientMembershipSaleTargetSnapshots" ("SaleId", "GroupId");
CREATE INDEX IF NOT EXISTS "IX_ClientMembershipSaleTargetSnapshots_GroupId"
    ON "ClientMembershipSaleTargetSnapshots" ("GroupId");
CREATE INDEX IF NOT EXISTS "IX_ClientMembershipSaleTargetSnapshots_BranchId"
    ON "ClientMembershipSaleTargetSnapshots" ("BranchId");

CREATE TABLE IF NOT EXISTS "ClientMembershipRefundTargetSnapshots" (
    "RefundId" uuid NOT NULL,
    "Position" integer NOT NULL,
    "GroupId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Provenance" character varying(32) NOT NULL,
    CONSTRAINT "PK_ClientMembershipRefundTargetSnapshots"
        PRIMARY KEY ("RefundId", "Position"),
    CONSTRAINT "CK_ClientMembershipRefundTargetSnapshots_Position"
        CHECK ("Position" >= 0 AND "Position" <= 4),
    CONSTRAINT "FK_CMRSTS_ClientMembershipRefunds"
        FOREIGN KEY ("RefundId") REFERENCES "ClientMembershipRefunds" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CMRSTS_TrainingGroups"
        FOREIGN KEY ("GroupId") REFERENCES "TrainingGroups" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CMRSTS_Branches"
        FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_ClientMembershipRefundTargetSnapshots_RefundId_GroupId"
    ON "ClientMembershipRefundTargetSnapshots" ("RefundId", "GroupId");
CREATE INDEX IF NOT EXISTS "IX_ClientMembershipRefundTargetSnapshots_GroupId"
    ON "ClientMembershipRefundTargetSnapshots" ("GroupId");
CREATE INDEX IF NOT EXISTS "IX_ClientMembershipRefundTargetSnapshots_BranchId"
    ON "ClientMembershipRefundTargetSnapshots" ("BranchId");

CREATE TABLE IF NOT EXISTS "AttendanceEntitlementTargetSnapshots" (
    "Id" uuid NOT NULL,
    "AttendanceId" uuid NOT NULL,
    "ClientId" uuid NOT NULL,
    "FactualGroupId" uuid NOT NULL,
    "TrainingDate" date NOT NULL,
    "MembershipId" uuid NULL,
    "SaleId" uuid NULL,
    "CoverageKind" character varying(32) NOT NULL,
    "TargetGroupId" uuid NULL,
    "TargetBranchId" uuid NULL,
    "Position" integer NOT NULL,
    "Provenance" character varying(32) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AttendanceEntitlementTargetSnapshots" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_AttendanceEntitlementTargetSnapshots_Position"
        CHECK ("Position" >= 0 AND "Position" <= 4),
    CONSTRAINT "FK_AETS_FactualTrainingGroup"
        FOREIGN KEY ("FactualGroupId") REFERENCES "TrainingGroups" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_AETS_TargetTrainingGroup"
        FOREIGN KEY ("TargetGroupId") REFERENCES "TrainingGroups" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_AETS_TargetBranch"
        FOREIGN KEY ("TargetBranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_AttendanceId"
    ON "AttendanceEntitlementTargetSnapshots" ("AttendanceId");
CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_ClientId_TrainingDate"
    ON "AttendanceEntitlementTargetSnapshots" ("ClientId", "TrainingDate");
CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_FactualGroupId"
    ON "AttendanceEntitlementTargetSnapshots" ("FactualGroupId");
CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_MembershipId"
    ON "AttendanceEntitlementTargetSnapshots" ("MembershipId");
CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_SaleId"
    ON "AttendanceEntitlementTargetSnapshots" ("SaleId");
CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_TargetGroupId"
    ON "AttendanceEntitlementTargetSnapshots" ("TargetGroupId");
CREATE INDEX IF NOT EXISTS "IX_AttendanceEntitlementTargetSnapshots_TargetBranchId"
    ON "AttendanceEntitlementTargetSnapshots" ("TargetBranchId");

WITH ranked_targets AS (
    SELECT
        membership."Id" AS membership_id,
        assignment."GroupId" AS group_id,
        group_row."BranchId" AS branch_id,
        row_number() OVER (
            PARTITION BY membership."Id"
            ORDER BY assignment."GroupId"
        ) - 1 AS position
    FROM "ClientMemberships" membership
    JOIN "ClientGroupAssignments" assignment
        ON assignment."ClientId" = membership."ClientId"
       AND assignment."ValidTo" IS NULL
    JOIN "TrainingGroups" group_row
        ON group_row."Id" = assignment."GroupId"
)
INSERT INTO "ClientMembershipTargetGroups" (
    "ClientMembershipId", "Position", "GroupId", "BranchId")
SELECT membership_id, position, group_id, branch_id
FROM ranked_targets
ON CONFLICT DO NOTHING;

WITH sale_targets AS (
    SELECT DISTINCT
        membership."SaleId" AS sale_id,
        target."GroupId" AS group_id,
        target."BranchId" AS branch_id
    FROM "ClientMemberships" membership
    JOIN "ClientMembershipTargetGroups" target
        ON target."ClientMembershipId" = membership."Id"
),
ranked_sale_targets AS (
    SELECT
        sale_id,
        group_id,
        branch_id,
        row_number() OVER (PARTITION BY sale_id ORDER BY group_id) - 1 AS position
    FROM sale_targets
)
INSERT INTO "ClientMembershipSaleTargetSnapshots" (
    "SaleId", "Position", "GroupId", "BranchId", "Provenance")
SELECT sale_id, position, group_id, branch_id, 'LegacyBackfill'
FROM ranked_sale_targets
ON CONFLICT DO NOTHING;

INSERT INTO "ClientMembershipRefundTargetSnapshots" (
    "RefundId", "Position", "GroupId", "BranchId", "Provenance")
SELECT
    refund."Id",
    snapshot."Position",
    snapshot."GroupId",
    snapshot."BranchId",
    'LegacyBackfill'
FROM "ClientMembershipRefunds" refund
JOIN "ClientMembershipSaleTargetSnapshots" snapshot
    ON snapshot."SaleId" = refund."SaleId"
ON CONFLICT DO NOTHING;

WITH linked_attendance AS (
    SELECT
        attendance."Id" AS attendance_id,
        attendance."ClientId" AS client_id,
        attendance."GroupId" AS factual_group_id,
        attendance."TrainingDate" AS training_date,
        membership."Id" AS membership_id,
        membership."SaleId" AS sale_id,
        membership."BehaviorKind" AS behavior_kind
    FROM "Attendance" attendance
    JOIN "ClientMemberships" membership
        ON membership."Id" = attendance."SingleVisitWriteOffMembershipId"
    UNION ALL
    SELECT
        attendance."Id",
        attendance."ClientId",
        attendance."GroupId",
        attendance."TrainingDate",
        membership."Id",
        membership."SaleId",
        membership."BehaviorKind"
    FROM "Attendance" attendance
    JOIN LATERAL (
        SELECT candidate.*
        FROM "ClientMemberships" candidate
        WHERE candidate."SaleId" = attendance."SingleVisitMembershipSaleId"
        ORDER BY candidate."ValidFrom" DESC, candidate."Id" DESC
        LIMIT 1
    ) membership ON true
    WHERE attendance."SingleVisitWriteOffMembershipId" IS NULL
),
snapshot_rows AS (
    SELECT
        linked.attendance_id,
        linked.client_id,
        linked.factual_group_id,
        linked.training_date,
        linked.membership_id,
        linked.sale_id,
        linked.behavior_kind,
        target."GroupId" AS target_group_id,
        target."BranchId" AS target_branch_id,
        target."Position" AS position
    FROM linked_attendance linked
    JOIN "ClientMembershipTargetGroups" target
        ON target."ClientMembershipId" = linked.membership_id
)
INSERT INTO "AttendanceEntitlementTargetSnapshots" (
    "Id", "AttendanceId", "ClientId", "FactualGroupId", "TrainingDate",
    "MembershipId", "SaleId", "CoverageKind", "TargetGroupId",
    "TargetBranchId", "Position", "Provenance", "CreatedAt")
SELECT
    (
        substr(md5(attendance_id::text || ':' || target_group_id::text), 1, 8) || '-' ||
        substr(md5(attendance_id::text || ':' || target_group_id::text), 9, 4) || '-' ||
        substr(md5(attendance_id::text || ':' || target_group_id::text), 13, 4) || '-' ||
        substr(md5(attendance_id::text || ':' || target_group_id::text), 17, 4) || '-' ||
        substr(md5(attendance_id::text || ':' || target_group_id::text), 21, 12)
    )::uuid,
    attendance_id,
    client_id,
    factual_group_id,
    training_date,
    membership_id,
    sale_id,
    CASE WHEN behavior_kind = 'Professional' THEN 'AllGroups' ELSE 'TargetGroups' END,
    target_group_id,
    target_branch_id,
    position,
    'LegacyBackfill',
    now()
FROM snapshot_rows
ON CONFLICT DO NOTHING;

ALTER TABLE "ClientMemberships"
    DROP CONSTRAINT IF EXISTS "EX_ClientMemberships_ClientId_Period_NoOverlap";

DO $postcheck$
DECLARE
    missing_target_count integer;
    missing_sale_snapshot_count integer;
BEGIN
    SELECT count(*)
    INTO missing_target_count
    FROM "ClientMemberships" membership
    WHERE NOT EXISTS (
        SELECT 1
        FROM "ClientMembershipTargetGroups" target
        WHERE target."ClientMembershipId" = membership."Id"
    );

    SELECT count(*)
    INTO missing_sale_snapshot_count
    FROM "ClientMembershipSales" sale
    WHERE NOT EXISTS (
        SELECT 1
        FROM "ClientMembershipSaleTargetSnapshots" snapshot
        WHERE snapshot."SaleId" = sale."Id"
    );

    IF missing_target_count > 0 OR missing_sale_snapshot_count > 0 THEN
        RAISE EXCEPTION
            'retained-membership-transition-incomplete: memberships=%, sales=%',
            missing_target_count,
            missing_sale_snapshot_count;
    END IF;
END
$postcheck$;

COMMIT;

SELECT
    (SELECT count(*) FROM "ClientMembershipTargetGroups") AS membership_targets,
    (SELECT count(*) FROM "ClientMembershipSaleTargetSnapshots") AS sale_target_snapshots,
    (SELECT count(*) FROM "ClientMembershipRefundTargetSnapshots") AS refund_target_snapshots,
    (SELECT count(*) FROM "AttendanceEntitlementTargetSnapshots") AS attendance_target_snapshots;
