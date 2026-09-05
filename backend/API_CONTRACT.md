# DealFlow360 API Contract — MVP 3

This contract covers the implemented MVP 1–2 API and MVP 3 fulfillment backend.

## Conventions

- Base URL: `http://localhost:4000`
- Authenticated requests use `Authorization: Bearer <token>`.
- JSON request header: `Content-Type: application/json`.
- Roles are `ADMIN`, `REP`, `MANAGER`, or `FINANCE`. Public signup accepts `REP`, `MANAGER`, or `FINANCE` in either upper- or lowercase; admins are system-provisioned. Responses use uppercase roles.
- Quotation statuses are `DRAFT`, `PENDING_MANAGER_APPROVAL`, `PENDING_FINANCE_APPROVAL`, `APPROVED`, `REJECTED`, `CONFIRMED`, and `FULFILLED`.
- Prisma `Decimal` fields are serialized as JSON strings, for example `"1299"` or `"5"`.
- Successful config endpoints wrap records in `{ "data": ... }`.
- All errors use `{ "error": { "code": string, "message": string, "details"?: object } }`.

Response record shapes:

- `Product`: `{ id, name, category, price, unit, tax, description, createdAt }`
- `PriceList`: `{ id, name, customerTier, currency, createdAt }`
- `Warehouse`: `{ id, name, location, createdAt, stockLevels }`
- `StockLevel`: `{ id, warehouseId, productId, qty, product }`
- `DiscountTier`: `{ id, tierName, maxDiscountPercent, createdAt, categoryOverrides }`
- `CategoryDiscountOverride`: `{ id, discountTierId, category, maxDiscountPercent }`
- `FulfillmentSplit`: `{ id, quotationId, warehouseId, productId, qtyFulfilled, qtyBackordered, createdAt, warehouse, product }`

IDs are UUID strings and timestamps are ISO-8601 strings. Nullable values such as `description` and `location` are returned as `null` when absent.

## Health

### `GET /health`

Runs a real database count query. `200` response:

```json
{ "status": "ok", "database": "connected", "userCount": 2 }
```

## Authentication

### `POST /api/auth/signup`

Request:

```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "password123", "role": "REP" }
```

`201` response:

```json
{
  "token": "<jwt>",
  "user": { "id": "<uuid>", "name": "Asha Rao", "email": "asha@example.com", "role": "REP", "createdAt": "<iso-date>" }
}
```

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_IN_USE`.

### `POST /api/auth/login`

Request: `{ "email": "asha@example.com", "password": "password123" }`.

`200` response has the same `{ token, user }` shape as signup. Error: `401 INVALID_CREDENTIALS`.

### `GET /api/auth/me`

Requires any authenticated role. `200` response:

```json
{ "user": { "id": "<uuid>", "name": "Asha Rao", "email": "asha@example.com", "role": "REP" } }
```

## Admin configuration

Every endpoint in this section requires authentication. Mutating endpoints and all non-product configuration reads require `ADMIN`; authenticated product reads are also available to reps for the quotation builder. Missing/invalid tokens return `401 UNAUTHENTICATED`, and insufficient roles return `403 FORBIDDEN`.

### Products

- `GET /api/products` → `200 { "data": Product[] }` (any authenticated role)
- `GET /api/products/:id` → `200 { "data": Product }` (any authenticated role)
- `POST /api/products` → `201 { "data": Product }`

Create body:

```json
{ "name": "ProBook 14", "category": "Hardware", "price": "1299.00", "unit": "unit", "tax": "18.00", "description": "Optional" }
```

### Price lists

- `GET /api/pricelists` → `200 { "data": PriceList[] }`
- `GET /api/pricelists/:id` → `200 { "data": PriceList }`
- `POST /api/pricelists` → `201 { "data": PriceList }`

Create body: `{ "name": "Gold USD", "customerTier": "GOLD", "currency": "USD" }`. `currency` defaults to `USD`.

### Warehouses

- `GET /api/warehouses` → `200 { "data": Warehouse[] }`
- `GET /api/warehouses/:id` → `200 { "data": Warehouse }`
- `POST /api/warehouses` → `201 { "data": Warehouse }`

Create body (stock is optional):

```json
{ "name": "Central Warehouse", "location": "Bengaluru", "stockLevels": [{ "productId": "<uuid>", "qty": 25 }] }
```

Warehouse responses include `stockLevels`, each with its related `product`.

### `POST /api/warehouses/:id/restock`

Requires `ADMIN`. Atomically increments an existing stock level or creates it when the warehouse does not yet stock that product.

Request:

```json
{ "productId": "<uuid>", "qty": 10 }
```

`qty` must be a positive integer. The `200` response is `{ "data": StockLevel }` and includes the related `warehouse` and `product`. Unknown warehouse or product IDs return `400 INVALID_REFERENCE`.

### Discount tiers

- `GET /api/discount-tiers` → `200 { "data": DiscountTier[] }`
- `GET /api/discount-tiers/:id` → `200 { "data": DiscountTier }`
- `POST /api/discount-tiers` → `201 { "data": DiscountTier }`

Create body:

```json
{
  "tierName": "Gold",
  "maxDiscountPercent": "15.00",
  "categoryOverrides": [{ "category": "Service", "maxDiscountPercent": "10.00" }]
}
```

`categoryOverrides` is optional and defaults to an empty array in MVP 1.

## Quotations

All quotation routes require authentication. A `REP` sees only their own quotations; `ADMIN`, `MANAGER`, and `FINANCE` can read all quotations. Creation is restricted to `REP`; editing and confirmation are restricted to the owning rep or an admin.

- `GET /api/quotations` → `{ "data": Quotation[] }`
- `GET /api/quotations/:id` → `{ "data": Quotation }`
- `POST /api/quotations`, body `{ "customerName": string }` → draft quotation; `repId` comes from the token.
- `PUT /api/quotations/:id`, body `{ "lines": [{ "productId": string, "qty": integer, "discountPercent": decimal }] }` → replaces lines and returns server-recomputed totals.
- `POST /api/quotations/:id/confirm` → submits a draft through discount governance and persists `blendedRiskScore`.

`PUT` replaces the full line collection, so sending a changed array handles additions, updates, and removals. `unitPrice`, `lineTotal`, and quotation totals in the request are ignored; prices are loaded from products and all totals are recomputed server-side. Each product can appear once, quantity must be a positive integer, and discount must be between 0 and 100. Only `DRAFT` quotations are editable.

MVP 2 uses the configured tier named `Standard` as the default governance tier, falling back to the oldest tier when `Standard` does not exist. The seed configures a 15% default ceiling and a 10% `Service` override. Submission routing is:

- Score `0` → `APPROVED`
- Score greater than `0` and at most `10` → `PENDING_MANAGER_APPROVAL`
- Score greater than `10` → `PENDING_FINANCE_APPROVAL`, with Manager still required before Finance

Quotation responses include `lines` and use this shape:

```json
{
  "id": "<uuid>",
  "customerName": "Acme Corp",
  "repId": "<uuid>",
  "status": "DRAFT",
  "subtotal": "2598.00",
  "totalDiscount": "259.80",
  "grandTotal": "2338.20",
  "blendedRiskScore": "8",
  "rep": { "id": "<uuid>", "name": "Asha Rao", "email": "asha@example.com", "role": "REP" },
  "lines": [{ "id": "<uuid>", "quotationId": "<uuid>", "productId": "<uuid>", "qty": 2, "unitPrice": "1299.00", "discountPercent": "10", "lineTotal": "2338.20", "product": { "...": "Product fields" } }],
  "createdAt": "<iso-date>",
  "updatedAt": "<iso-date>"
}
```

## Approvals

All approval endpoints require authentication. Action endpoints allow `MANAGER` and `FINANCE` at the route level, then verify that the quotation is currently awaiting that exact role.

### `GET /api/quotations/pending`

Returns `200 { "data": Quotation[] }`. Managers receive manager-first work, including high-risk quotes that will subsequently need Finance. Finance receives high-risk quotes only after Manager approval. Other roles receive `403 FORBIDDEN`.

### `POST /api/quotations/:id/approve`

No request body is required. Manager approval moves a moderate-risk quotation to `APPROVED`; high-risk quotations remain `PENDING_FINANCE_APPROVAL` and become available to Finance. Finance approval moves the quotation to `APPROVED`.

`200` response: `{ "data": Quotation }`.

### `POST /api/quotations/:id/reject`

Request: `{ "reason": "Discount is not commercially viable" }`.

Moves the quotation to `REJECTED` and returns `200 { "data": Quotation }`.

### `POST /api/quotations/:id/return`

Request: `{ "reason": "Please revise the service discount" }`.

Moves the quotation back to `DRAFT`, resets its current risk score to zero, and returns `200 { "data": Quotation }`.

Every approve, reject, and return action writes an `ApprovalLog` containing `quotationId`, `actorId`, `action`, optional `reason`, and `createdAt`.

### `GET /api/quotations/:id/history`

Returns the quotation's approval log oldest-to-newest. Reps can read their own quotation history; Admin, Manager, and Finance can read any quotation history.

`200` response:

```json
{
  "data": [
    {
      "id": "<uuid>",
      "quotationId": "<uuid>",
      "actorId": "<uuid>",
      "action": "APPROVED",
      "reason": null,
      "createdAt": "<iso-date>",
      "actor": { "id": "<uuid>", "name": "Demo Sales Manager", "role": "MANAGER" }
    }
  ]
}
```

An unknown quotation returns `404 NOT_FOUND`; a rep requesting another rep's history receives `403 FORBIDDEN`.

## Fulfillment

Fulfillment endpoints require a quotation with status `APPROVED`. They are available to the quotation's owning `REP` and to `ADMIN`. Other roles receive `403 FORBIDDEN`; attempting to fulfill a quotation in another state returns `409 INVALID_QUOTATION_STATUS`.

### `GET /api/quotations/:id/fulfillment/suggest`

Returns a calculated proposal without saving rows or changing stock. Each line is assigned to one warehouse when possible; otherwise it is split across warehouses in descending available-stock order.

`200` response:

```json
{
  "data": [
    {
      "quotationId": "<uuid>",
      "warehouseId": "<uuid>",
      "productId": "<uuid>",
      "qtyFulfilled": 25,
      "qtyBackordered": 0,
      "warehouse": { "id": "<uuid>", "name": "Central Warehouse", "location": "Bengaluru", "createdAt": "<iso-date>" }
    }
  ]
}
```

When total stock is insufficient, the uncovered quantity appears once as `qtyBackordered`. If no warehouse has a `StockLevel` for a product, the unsaved proposal has `warehouseId: null`, `warehouse: null`, and the full ordered quantity backordered.

### `POST /api/quotations/:id/fulfillment/confirm`

Request body is the accepted suggestion or a manually edited allocation array:

```json
[
  { "warehouseId": "<central-uuid>", "productId": "<product-uuid>", "qtyFulfilled": 25 },
  { "warehouseId": "<west-uuid>", "productId": "<product-uuid>", "qtyFulfilled": 5 }
]
```

Every quotation product must have at least one allocation row. A warehouse/product pair may appear only once, and `qtyFulfilled` must be a non-negative integer. The server derives `qtyBackordered`; client-supplied backorder values are ignored.

Confirmation runs atomically: it rechecks current stock, prevents allocation above the ordered quantity, decrements stock, saves `FulfillmentSplit` rows, and changes the quotation status to `FULFILLED`. Any validation or stock failure rolls back all changes.

`200` response is `{ "data": Quotation }`, including `fulfillmentSplits` with related `warehouse` and `product` records.

Relevant errors:

- `400 VALIDATION_ERROR` for a missing/invalid body or quantity.
- `400 INVALID_FULFILLMENT_SPLIT` for a duplicate pair, an unrelated product, or a missing quotation product allocation.
- `400 INVALID_REFERENCE` when a warehouse does not exist.
- `409 FULFILLMENT_OVER_ALLOCATION` when product allocations exceed the ordered quantity.
- `409 INSUFFICIENT_STOCK` when current warehouse stock cannot cover an allocation.
- `409 INVALID_QUOTATION_STATUS` unless the quotation is currently `APPROVED`.

### `GET /api/quotations/:id/fulfillment/backorder-check`

Available to the quotation's owning `REP` and to `ADMIN` after fulfillment has been finalized. This endpoint is read-only: it checks current stock and proposes additional allocations for outstanding `qtyBackordered` amounts without changing inventory or persisted fulfillment rows.

`200` response:

```json
{
  "data": {
    "canConsolidate": true,
    "fullyCoverable": true,
    "outstandingBackorders": [
      { "productId": "<uuid>", "qtyBackordered": 10 }
    ],
    "suggestedAllocations": [
      {
        "quotationId": "<uuid>",
        "warehouseId": "<uuid>",
        "productId": "<uuid>",
        "qtyFulfilled": 10,
        "qtyBackordered": 0,
        "warehouse": { "id": "<uuid>", "name": "West Warehouse", "location": "Mumbai", "createdAt": "<iso-date>" }
      }
    ]
  }
}
```

`canConsolidate` is true when at least one outstanding unit can now be allocated. `fullyCoverable` is true when current stock covers every outstanding backorder. If stock is only partially available, the suggestion contains the still-uncovered amount in `qtyBackordered`.

Calling this endpoint before the quotation reaches `FULFILLED` returns `409 INVALID_QUOTATION_STATUS`.

## Shared error statuses

- `400 VALIDATION_ERROR` or `INVALID_REFERENCE`
- `401 UNAUTHENTICATED` or `INVALID_CREDENTIALS`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 CONFLICT` or `EMAIL_IN_USE`
- `409 QUOTATION_NOT_EDITABLE` or `INVALID_QUOTATION_STATUS`
- `409 DISCOUNT_TIER_REQUIRED`
- `409 FULFILLMENT_OVER_ALLOCATION` or `INSUFFICIENT_STOCK`
- `400 INVALID_FULFILLMENT_SPLIT`
- `400 EMPTY_QUOTATION`
- `500 INTERNAL_ERROR`
