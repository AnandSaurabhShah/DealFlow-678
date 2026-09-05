# DealFlow360 Final Seed Guide

The final seed combines focused acceptance-test scenarios with a deterministic load dataset.
Every Prisma model contains at least 150 rows, including the MVP 5 customer and negotiation
tables.

## Run and verify

```bash
npx prisma db seed
npm run test:seed
```

Rerunning the seed restores the generated fixtures instead of duplicating them.

## Main accounts

| Workspace | Email | Default password |
| --- | --- | --- |
| Internal admin | `admin@dealflow360.test` | `Admin123!` |
| Internal sales rep | `rep@dealflow360.test` | `Rep12345!` |
| Internal manager | `manager@dealflow360.test` | `Manager123!` |
| Internal finance | `finance@dealflow360.test` | `Finance123!` |
| Customer portal A | `customer.a@dealflow360.test` | `Customer123!` |
| Customer portal B | `customer.b@dealflow360.test` | `CustomerB123!` |

Environment variables named `SEED_*_PASSWORD` override these defaults.

The demo rep owns the generated quotations, so one internal login can browse the full dataset.
Generated portal customers use emails such as `load-customer-026@dealflow360.test` and the
default customer password `Customer123!`.

## Covered states

- Draft, manager approval, finance approval, approved, rejected, and fulfilled quotations
- Warehouse stock, multi-warehouse fulfillment, and backorders
- One-time and recurring products, invoices, monthly schedules, payments, and credits
- Sent-to-customer and under-negotiation quotations
- Customer and internal comments, line-level comments, and every negotiation audit action
- Approval re-entry rounds after customer discount requests

The hand-crafted scenario IDs documented in the MVP-specific seed guides remain available.
