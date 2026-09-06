# MVP 4 Billing Seed Guide

Run:

```bash
npx prisma db seed
npm run test:mvp4-seed
```

Sign in as `rep@dealflow360.test` using `SEED_REP_PASSWORD`, or `Rep12345!` when the seed password environment variable is not configured.

The seed provides these deterministic frontend scenarios:

| Quotation | ID | Intended test |
| --- | --- | --- |
| MVP4 Ready to Generate Billing | `00000000-0000-4000-8000-000000000501` | Customer-confirmed mixed one-time and recurring lines with no billing records. Use the Generate Billing action. |
| MVP4 Active Hybrid Billing | `00000000-0000-4000-8000-000000000502` | Unpaid one-time invoice, four monthly entries, and an existing quantity-reduction credit. Test quantity changes, cancellation, and payment. |
| MVP4 Cancelled Subscription | `00000000-0000-4000-8000-000000000503` | Paid one-time invoice, one billed recurring cycle, three cancelled cycles, and a cancellation credit note. |

The schedule dates are calculated relative to the day the seed runs, keeping upcoming entries useful in the frontend. Running the seed repeatedly restores these scenarios to their original states.
