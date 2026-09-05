# MVP 5 Customer Negotiation Seed Guide

Run:

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run test:mvp5-seed
```

Demo customer accounts:

| Customer | Email | Default password |
| --- | --- | --- |
| Customer A | `customer.a@dealflow360.test` | `Customer123!` |
| Customer B | `customer.b@dealflow360.test` | `CustomerB123!` |

Override the passwords with `SEED_CUSTOMER_PASSWORD` and `SEED_CUSTOMER_B_PASSWORD`.

Deterministic scenarios:

| Quotation | ID | Intended test |
| --- | --- | --- |
| Customer A within-limit | `00000000-0000-4000-8000-000000000701` | Send, request a discount up to the Service ceiling, confirm without approval. |
| Customer A re-approval | `00000000-0000-4000-8000-000000000702` | Send, request an over-limit Service discount, confirm, then approve as Manager. |
| Customer B isolation | `00000000-0000-4000-8000-000000000703` | Already sent and accessible only to Customer B; use it for BOLA/IDOR checks. |

The first two quotations are linked but remain `APPROVED`; use the internal send endpoint before opening them in the portal. The third is already `SENT_TO_CUSTOMER`.
