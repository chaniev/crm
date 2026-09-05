# TASK-083 baseline contract matrix

Captured before production changes on 2026-07-24.

Implementation completed and validated on a clean local stand on 2026-07-24.

| Surface | Baseline contract | TASK-083 contract |
| --- | --- | --- |
| Purchase | Accepts `paymentStatus`; `Unpaid` creates an unpaid membership version | Requires `paymentDate`; sale and assignment are paid by definition; negative legacy marker is rejected before writes |
| Renewal | Accepts `paymentStatus`; payment metadata is copied to a new membership version | Requires `paymentDate`; payment metadata belongs to the new sale and is projected to all its versions |
| Sale-creating transfer | Accepts payment status/date without the membership idempotency boundary | Requires `paymentDate` and `Idempotency-Key`; sale, assignment, audit, and idempotency complete atomically |
| Preserved SingleVisit transfer | Reuses the existing membership/sale | Continues to reuse the sale; payment fields are rejected and no new sale is created |
| Correction | Changes membership validity on an addressed membership version | May additionally change sale-owned `PaymentDate`; keeps purchase date, validity, attribution, and attendance unchanged and audits old/new date |
| Current/history reads | Expose version-owned `isPaid`, `paidBy`, and `paidAt` | Expose sale-owned `paymentDate` plus recorded actor/name/time; no paid/unpaid state |
| Mark payment | Mutates an unpaid membership version through web and bot endpoints | Protected tombstones return `410 membership-payment-action-removed` without writes |
| Attendance | Unpaid membership can block or warn attendance | Eligibility is independent from payment state; validity, expiration, professional, and SingleVisit rules remain |
| Attention/home | Expose unpaid issue/state/reason and debt-oriented UI | Remove unpaid state/reason/badge/action while preserving expiration and missed-training attention |
| Client filters | Accept payment status and active-paid/unpaid filters | Removed payment-state filters return `400 membership-payment-filter-removed`; active contract becomes status-free |
| Internal bot | Exposes unpaid list and mark-payment action | Active reads are status-free; unpaid list tombstone returns `410 membership-unpaid-list-removed` |
| Financial report | Uses sale `PurchaseDate` for both accounting and attribution | Sale accounting uses `PaymentDate`, sale attribution uses `PurchaseDate`; refund uses `RefundDate` for both |
| Persistence | `ClientMembership` stores `IsPaid`, `PaidByUserId`, and `PaidAt` | `ClientMembershipSale` stores required PostgreSQL `date` `PaymentDate`; version payment columns are absent |
| Deployment | Existing bundle and persisted schema understand paid/unpaid state | Backend, frontend, and bot deploy together after recreating PostgreSQL from the updated initial state |

## Runtime database policy

The implementation request explicitly requires a clean deployment after the change. Existing PostgreSQL rows and volumes do not need migration or backfill. TASK-083 therefore updates the reproducible initial EF migration, its designers, the model snapshot, seed data, and test fixtures; it does not add a new migration.
