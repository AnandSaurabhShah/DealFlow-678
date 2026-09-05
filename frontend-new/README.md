# DealFlow360 frontend

React and Vite frontend for the incremental DealFlow360 workflow through MVP 4.

## Setup

1. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend origin (default: `http://localhost:4000`).
2. Start and seed the backend as described in `../backend/README.md`.
3. Install dependencies with `npm install`.
4. Start the frontend with `npm run dev`.

Zustand stores the authenticated session and workspace navigation. TanStack React Query owns API-backed products, configuration, and quotation state. Axios uses the backend contract from `../backend/API_CONTRACT.md` and attaches the JWT automatically.

## Included screens

- Real login and team signup. Admin signup is intentionally unavailable; the admin is seeded/configured by the system.
- Role-aware quotation list.
- Rep quotation builder with live client totals and server re-synchronization on save.
- Admin create/list screens for products, price lists, warehouses, and discount tiers.
- Fulfillment suggestions, confirmation, inventory conflicts, and backorder checks.
- Hybrid billing with separate one-time invoices and recurring monthly schedules.
- Billing generation, quantity proration, subscription cancellation, credit notes, and invoice payment.

For ready-made billing examples, seed the backend and sign in as
`rep@dealflow360.test`. See `../backend/MVP4_SEED_GUIDE.md` for the three scenarios.

Run `npm run lint` and `npm run build` before handoff.
