# DealFlow360 — Product Specification

## What This Is

DealFlow360 is a **self-governing B2B Sales Operations platform**. It is not a simple "create quote → confirm order → invoice" tool. It handles the messy realities of real B2B sales:

- Multi-level discount approvals based on customer tier and product category
- Stock spread across multiple warehouses
- Bundled subscriptions mixed with one-time hardware on the same order
- Customers negotiating live inside a portal instead of over email
- Managers needing early visibility into deals that are stuck or bleeding margin

**Core idea:** a quotation is a *living, negotiable document* governed by business rules, not a static PDF.

**Tech stack:** MERN (PostGres, Express.js, React.js, Prisma).

---

## User Roles

| Role | Responsibilities |
|---|---|
| **Sales Rep** | Builds quotations, applies discounts, adds upsell items, tracks approval/fulfillment status, responds to customer negotiation |
| **Sales Manager / Approver** | Reviews/approves/rejects quotations over discount thresholds, configures discount tiers and approval chains, monitors deal health dashboard |
| **Finance / Operations** | Second-level approval for high-risk discounts, manages warehouse fulfillment splits and backorders, reconciles recurring billing and credit notes |
| **Customer (Portal User)** | Views quotation online, requests changes/counters, confirms final terms |
| **Admin** | Manages backend setup (products, price lists, discount tiers, warehouses, subscription plans), views platform-wide analytics |

---

## Core Modules

### A) Sales Backend (Configuration)
1. **Auth** — internal users sign up/log in with credentials; customers get portal access (magic link or email/password)
2. **Product & Price List Management** — products (name, category, price, unit, tax, description), variants, customer-tier-based price lists
3. **Discount Tier & Approval Chain Setup**
   - Discount ceilings per customer tier (e.g. Bronze ≤5%, Silver ≤10%, Gold ≤15%)
   - **Category-specific** discount ceilings (e.g. Hardware allows more discretion than Services)
   - Approval chain config: which discount range needs Manager only vs. Manager → Finance
   - All approvals/rejections/edits logged with user, timestamp, reason
4. **Warehouse & Fulfillment Setup** — warehouses, stock levels, replenishment rules, shipping cost weighting (used to minimize number of shipments in auto-split)
5. **Subscription / Recurring Plan Setup** — recurring plans (monthly/quarterly/yearly), proration rules for mid-cycle changes, cancellation/refund rules
6. **Upsell / Cross-Sell Rule Setup** *(optional/bonus)* — product pairings from co-purchase data, promoted product flags, minimum margin thresholds
7. **Reporting & Dashboard Config** — filters by Period, Sales Team/Rep, Approval Status, Product/Category; export to PDF/XLS

### B) Sales Frontend (Rep Workspace)
1. **Workspace top nav** — Quotations, Pipeline (Kanban), Reload Data, Go to Backend, Close Workspace
2. **Quotation List / Pipeline View** — cards showing customer, amount, stage
3. **Quotation Builder** — pick products across categories, adjust quantities, apply line/order discounts, live totals + margin indicator, confirm → approval or straight to fulfillment
4. **Discount Approval Screen** — shows blended risk score, approval steps (Manager, then Finance if required), approve/reject/return-for-revision, full audit trail
5. **Upsell/Cross-Sell Panel** — ranked suggestions with margin delta and promo tags, shown alongside cart while building a quote; updates margin indicator immediately on add
6. **Fulfillment & Warehouse Split Screen** — recommended split by warehouse with qty/shipment/cost estimate; Accept Suggested Split or Manual Override; auto "Consolidate Remaining Backorder" prompt when stock arrives mid-fulfillment
7. **Subscription & Billing Screen** — one-time vs. recurring lines shown separately, upcoming billing schedule, mid-cycle proration, cancel/modify with auto partial refund/credit note
8. **Customer Portal Negotiation Screen** — separate, restricted view: quotation status (Sent/Under Negotiation/Confirmed), line-level comments/change requests, counter-discount field, Submit Request / Confirm Quotation. If confirmed terms exceed thresholds → auto re-enters approval flow.
9. **Deal Health & Anomaly Dashboard** — stalled deals (inactive > N days), discount anomaly alerts (discount well above rep's historical average), delivery slippage indicators, click-through to quotation, nudge/escalation action

---

## The Blended Discount Risk Score (Critical Business Logic)

This score decides whether a quotation needs Manager approval, and if so, whether it escalates to Finance too.

**Key principle:** every line is checked against **its own category's discount ceiling**, not one blanket order-level limit.

**Example:** A Gold customer is normally allowed up to 15% discount overall. But:
- Hardware allows up to 15% (healthy margin)
- Services allow only up to 10% (thin margin)

If a rep gives 12% on a Laptop (Hardware, fine) but 18% on a Setup Service (Service, 8 points over its own 10% limit), **the whole quotation gets flagged** — even though 15% "sounds fine" for a Gold customer overall.

**"Blended" also means:** the score looks at the *cumulative pattern* across all lines, not just the single worst line. Several small over-limit lines (2 points over here, 3 there) can add up to serious margin leakage even if no single line looks alarming alone.

**Why it matters:** managers don't have to review every quote by hand, and reps can't game per-line limits to quietly over-discount the whole order.

---

## Non-Negotiable Technical Requirements

- Core business rules (approval routing, discount governance, warehouse splitting, billing proration) **must be implemented in real application logic** — not hardcoded or faked for a demo.
- The customer-facing negotiation screen must be a **real, separate, restricted view** — not an internal screen with a different label.
- All approvals, rejections, and edits must be **logged** (user, timestamp, reason) — this is an audit trail requirement, not optional polish.
- Multi-currency / multi-company support is a bonus, not required.

---

## End-to-End Flow (What "Done" Looks Like)

1. Rep signs up/logs in
2. Admin configures backend: products, price lists, discount tiers, approval chains, warehouses, subscription plans
3. Rep creates a quotation, adds products, applies discounts, sees upsell suggestions with live margin impact
4. If discount/blended risk score exceeds threshold → auto-routes to Manager, then Finance if required
5. Once approved (or immediately if no approval needed) → system suggests a warehouse fulfillment split
6. Order can include recurring subscription lines → generates a billing schedule alongside any one-time invoice
7. Customer receives a portal link, negotiates directly (no email back-and-forth)
8. If negotiated terms exceed thresholds → quote automatically re-enters approval flow
9. Once confirmed → order proceeds to fulfillment and billing
10. Manager watches the Deal Health dashboard throughout for stalled/risky deals
11. Reports are reviewed with filters (Period / Sales Team / Approval Status / Product)

---

## Acceptance Test (Quick Test Flow)

A working build should satisfy all of these, each producing a visible, correct result:

1. Sign up/log in; set up a discount tier, a warehouse, and a subscription plan
2. Create a quotation, add a product line with a discount higher than normally allowed
3. Confirm the system automatically requires Manager approval — without the rep requesting it
4. While building the quote, accept an upsell suggestion; order total/margin update immediately
5. Get the quote approved; confirm stock pulls from the correct warehouse(s), splitting across two if needed
6. Confirm a one-time product and a recurring subscription on the same order bill correctly and separately
7. Open the customer portal, request a bigger discount as the customer, confirm it re-triggers approval automatically
8. Confirm the order, record a payment, confirm invoice status updates correctly

If all 8 steps work and match expectations, the core flow is solid.
