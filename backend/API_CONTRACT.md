# DealFlow360 API Contract — MVP 1

This contract is frozen for the MVP 1 frontend and matches the implemented BE-Phases 2–4 routes.

## Conventions

- Base URL: `http://localhost:4000`
- Authenticated requests use `Authorization: Bearer <token>`.
- JSON request header: `Content-Type: application/json`.
- Roles are `ADMIN`, `REP`, `MANAGER`, or `FINANCE`. Public signup accepts `REP`, `MANAGER`, or `FINANCE` in either upper- or lowercase; admins are system-provisioned. Responses use uppercase roles.
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
- `POST /api/quotations/:id/confirm` → changes `status` from `DRAFT` to `CONFIRMED`. Confirming an already-confirmed quotation is idempotent.

`PUT` replaces the full line collection, so sending a changed array handles additions, updates, and removals. `unitPrice`, `lineTotal`, and quotation totals in the request are ignored; prices are loaded from products and all totals are recomputed server-side. Each product can appear once, quantity must be a positive integer, and discount must be between 0 and 100.

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
  "rep": { "id": "<uuid>", "name": "Asha Rao", "email": "asha@example.com", "role": "REP" },
  "lines": [{ "id": "<uuid>", "quotationId": "<uuid>", "productId": "<uuid>", "qty": 2, "unitPrice": "1299.00", "discountPercent": "10", "lineTotal": "2338.20", "product": { "...": "Product fields" } }],
  "createdAt": "<iso-date>",
  "updatedAt": "<iso-date>"
}
```

## Shared error statuses

- `400 VALIDATION_ERROR` or `INVALID_REFERENCE`
- `401 UNAUTHENTICATED` or `INVALID_CREDENTIALS`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 CONFLICT` or `EMAIL_IN_USE`
- `409 QUOTATION_CONFIRMED`
- `400 EMPTY_QUOTATION`
- `500 INTERNAL_ERROR`
