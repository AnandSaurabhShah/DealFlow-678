# DealFlow360 — MVP Roadmap

## Purpose of This Document

This document defines how DealFlow360 (see `01_PRODUCT_SPEC.md`) is built incrementally across **6 MVPs**. Each MVP must result in a **fully working, demoable application** — never a half-built feature. Build strictly in order: each MVP depends on the data model and logic established in the ones before it.

**Stack:** MongoDB + Express.js + React.js + Node.js (MERN)

**Rule for the Agentic AI:** Do not start MVP N+1 until every item in MVP N's "Definition of Done" is verifiably working. If a shortcut is taken (e.g. mock data, skipped validation), it must be explicitly flagged in commit messages / notes, not silently left in place.

---

## MVP 1 — Core Skeleton: Login → Configure → Quote → Confirm

**Goal:** Prove the full stack connects and the base data model is sound. No approval logic, no fulfillment, no billing yet.

**Scope:**
- Auth: signup/login for internal users (roles: `admin`, `rep`, `manager`, `finance` — build the enum now even if only admin/rep are used yet)
- Minimal backend config: Products, one Price List, one Warehouse, one Discount Tier (flat, no category ceilings yet)
- Quotation Builder: add products, adjust quantity, apply a flat order/line discount, live totals
- Confirm a quotation directly (status flips to `confirmed`, no routing/gating)

**Definition of Done:**
- [ ] A user can sign up, log in, and stay authenticated via JWT
- [ ] Admin can create at least: 2+ products (in 2+ categories), 1 warehouse, 1 discount tier
- [ ] Seed script exists and populates realistic sample data (needed by every later MVP)
- [ ] Rep can create a quotation, add lines, see correct running totals (subtotal, discount, grand total)
- [ ] Rep can confirm a quotation and see it reflected in a quotation list
- [ ] Core calculation logic (`calculateQuotationTotals`) lives in its own isolated module — MVP 2 will reuse it
- [ ] Mongoose schemas for User, Product, PriceList, Warehouse, DiscountTier, Quotation exist and match the extensible shape described in `01_PRODUCT_SPEC.md` (e.g. `DiscountTier.categoryOverrides` field present even if empty)

**Explicitly NOT in scope:** approval routing, warehouse splitting, billing/subscriptions, customer portal, dashboards, reporting.

---

## MVP 2 — Discount Governance (Blended Risk Score + Approval Routing)

**Goal:** Implement the platform's signature business logic — the blended discount risk score — and gate quotation confirmation behind it.

**Scope:**
- Category-specific discount ceilings on Discount Tiers
- Approval chain config (which discount range needs Manager only vs. Manager → Finance)
- Blended risk score calculation across all lines (see `01_PRODUCT_SPEC.md` for the exact logic and example)
- Approval screen: shows risk score, approval steps, approve/reject/return-for-revision
- Audit trail: every approval action logged with user, timestamp, reason

**Definition of Done:**
- [ ] Discount ceilings can be set per tier AND per category, and both are enforced
- [ ] A quotation with any line exceeding its category ceiling is automatically flagged for approval — rep does not manually request it
- [ ] The blended score correctly catches BOTH cases: (a) one severely over-limit line, and (b) several mildly over-limit lines that add up
- [ ] Approval chain correctly routes to Manager-only or Manager→Finance based on configured thresholds
- [ ] Manager/Finance can approve, reject, or return a quotation for revision
- [ ] Every approval action is persisted with user, timestamp, and reason — queryable as an audit trail
- [ ] A quotation cannot move to "confirmed" status while still pending approval

**Acceptance test:** Recreate the PS example (Gold customer, Hardware line within limit, Service line 8 points over) and confirm it correctly flags for approval.

---

## MVP 3 — Fulfillment Splitting

**Goal:** Once a quotation is approved, determine how it's fulfilled across warehouse stock.

**Scope:**
- Warehouse stock levels and shipping cost weighting configured
- Auto-split logic: allocate order lines across warehouses based on live stock, minimizing shipment count
- Fulfillment screen: shows warehouse, quantity fulfilled, estimated shipment count/cost
- Manual override of the suggested split
- "Consolidate Remaining Backorder" prompt when stock arrives mid-fulfillment

**Definition of Done:**
- [ ] Only approved (or approval-not-required) quotations can proceed to fulfillment
- [ ] System correctly splits an order across 2+ warehouses when no single warehouse has full stock
- [ ] System correctly keeps an order to 1 warehouse when possible (shipment-minimizing logic actually runs, not just first-match)
- [ ] Rep can accept the suggested split or manually override it
- [ ] Backorder state is tracked, and a consolidation prompt appears when new stock arrives for a previously split/backordered line

---

## MVP 4 — Hybrid Billing (One-Time + Subscription)

**Goal:** Support one-time and recurring billing lines on the same order, correctly reconciled.

**Scope:**
- Subscription plan setup (monthly/quarterly/yearly), proration rules, cancellation/refund rules
- Billing screen: one-time lines and recurring lines shown separately on the same order
- Billing schedule generation for recurring lines
- Mid-cycle proration when quantity/plan changes
- Cancel/modify subscription controls with automatic partial refund or credit note trigger

**Definition of Done:**
- [ ] A single order can contain both a one-time product line and a recurring subscription line
- [ ] One-time lines generate a standard invoice; recurring lines generate a billing schedule (not a single invoice)
- [ ] Changing quantity on a recurring line mid-cycle correctly prorates the next billing amount
- [ ] Canceling a subscription triggers a partial refund or credit note per configured rules
- [ ] Billing data is correctly separated in the UI (rep can see: "these lines bill once, these lines bill on a schedule")

---

## MVP 5 — Customer Portal Negotiation

**Goal:** Give customers a real, separate, restricted view to negotiate a quotation directly — and hook that back into the approval engine from MVP 2.

**Scope:**
- Customer auth (magic link or email/password), separate from internal roles
- Portal screen: quotation status (Sent / Under Negotiation / Confirmed), line-level comments/change requests, counter-discount field
- Submit Request and Confirm Quotation actions
- Re-entry hook: if confirmed terms exceed approval thresholds, automatically re-run the blended risk score and re-enter the MVP 2 approval flow

**Definition of Done:**
- [ ] Customer portal is a genuinely separate, access-restricted view — not an internal screen with a different label or role check
- [ ] Customer can view their quotation, leave line-level comments, and submit a counter-discount request
- [ ] Rep/Manager can see and respond to customer requests from the internal workspace
- [ ] If a customer's confirmed counter-offer exceeds discount thresholds, the quotation automatically re-enters approval (reusing MVP 2's logic, not a reimplementation)
- [ ] If the counter-offer does NOT exceed thresholds, the order proceeds directly to fulfillment (MVP 3) without unnecessary approval

**Acceptance test:** As a customer, request a bigger discount than allowed → confirm it correctly triggers approval automatically (PS Quick Test Flow step 7).

---

## MVP 6 — Analytics Layer: Upsell/Cross-Sell + Deal Health Dashboard + Reporting

**Goal:** Add the read/aggregate layers on top of real data generated by MVPs 1–5. This is the stretch/polish MVP — safe to trim under time pressure since nothing downstream depends on it.

**Scope:**
- Upsell/cross-sell suggestion panel (co-purchase pairings, promoted tags, margin thresholds) shown during quote building, updating margin live on add
- Deal Health dashboard: stalled deals (inactive > N days), discount anomaly alerts (vs. rep's historical average), delivery slippage indicators, click-through to quotation, nudge/escalation action
- Reporting screen: filters by Period, Sales Team/Rep, Approval Status, Product/Category; export to PDF/XLS

**Definition of Done:**
- [ ] Upsell panel shows ranked suggestions with margin delta; adding one updates the quotation's margin indicator immediately
- [ ] Dashboard correctly identifies at least: stalled deals and discount anomalies, computed from real quotation data (not hardcoded)
- [ ] Clicking a dashboard alert opens the related quotation
- [ ] Reporting filters actually filter the underlying quotation/order data correctly
- [ ] At least one export format (PDF or XLS) works

---

## Cross-MVP Rules (Apply Throughout)

- **No faked business logic.** Approval routing, discount governance, warehouse splitting, and billing proration must be real application logic per `01_PRODUCT_SPEC.md`, even in early MVPs.
- **Schema stability.** Don't restructure a Mongoose schema from a prior MVP unless absolutely required — extend it. Later MVPs are written assuming earlier schemas are stable.
- **Tag each MVP on completion** (e.g. `git tag mvp1`, `mvp2`, ...) so there is always a known-good rollback point.
- **Re-run the relevant PS "Quick Test Flow" steps** (see `01_PRODUCT_SPEC.md`) applicable to the current MVP before marking it done.
