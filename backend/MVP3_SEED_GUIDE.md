# MVP 3 Seed Verification Guide

Run the seed from `backend`:

```powershell
npm.cmd run prisma:seed
npm.cmd run test:mvp3-seed
```

The second command verifies all four seeded scenarios and reports a failure if their quantities or statuses drift.

Use the seeded Rep for quotation fulfillment routes:

- Email: `rep@dealflow360.test`
- Password: `Rep12345!` unless overridden by `SEED_REP_PASSWORD`

Use the seeded Admin for restocking:

- Email: `admin@dealflow360.test`
- Password: `Admin123!` unless overridden by `SEED_ADMIN_PASSWORD`

## Warehouses and stock after every seed

| Warehouse | ID | ProBook stock | Backorder Demo stock |
|---|---|---:|---:|
| Central Warehouse | `00000000-0000-4000-8000-000000000201` | 25 | 0 |
| West Warehouse | `00000000-0000-4000-8000-000000000202` | 15 | 0 |

## Verification quotations

### Single warehouse

- ID: `00000000-0000-4000-8000-000000000401`
- Status: `APPROVED`
- Order: 10 ProBook laptops
- Expected suggestion: one row, Central Warehouse, `qtyFulfilled: 10`, `qtyBackordered: 0`

```text
GET /api/quotations/00000000-0000-4000-8000-000000000401/fulfillment/suggest
```

### Two-warehouse split

- ID: `00000000-0000-4000-8000-000000000402`
- Status: `APPROVED`
- Order: 30 ProBook laptops
- Expected suggestion: Central 25 and West 5, with no backorder

```text
GET /api/quotations/00000000-0000-4000-8000-000000000402/fulfillment/suggest
```

### Insufficient total stock

- ID: `00000000-0000-4000-8000-000000000403`
- Status: `APPROVED`
- Order: 50 ProBook laptops
- Expected suggestion: Central 25, West 15, and one `qtyBackordered: 10`

```text
GET /api/quotations/00000000-0000-4000-8000-000000000403/fulfillment/suggest
```

### Restock and consolidation

- ID: `00000000-0000-4000-8000-000000000404`
- Status: `FULFILLED`
- Persisted fulfillment: 5 fulfilled and 10 backordered
- Dedicated product ID: `00000000-0000-4000-8000-000000000601`

Before restocking, this returns `canConsolidate: false`:

```text
GET /api/quotations/00000000-0000-4000-8000-000000000404/fulfillment/backorder-check
```

Restock 4 units at West to verify partial availability:

```text
POST /api/warehouses/00000000-0000-4000-8000-000000000202/restock
{ "productId": "00000000-0000-4000-8000-000000000601", "qty": 4 }
```

The backorder check should now return `canConsolidate: true`, `fullyCoverable: false`, and 6 units still backordered.

Restock another 6 units and check again. It should return `canConsolidate: true`, `fullyCoverable: true`, and a suggested allocation of all 10 units from West Warehouse.

Rerun the seed whenever you want to restore all quantities and scenarios to their initial state. Suggestions do not mutate stock, but fulfillment confirmation and restocking do.
