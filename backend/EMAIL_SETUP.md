# Quotation email delivery

DealFlow360 sends a direct customer-portal link when an approved quotation is shared. Configure any SMTP-compatible provider in `backend/.env`:

```env
CUSTOMER_PORTAL_URL="http://localhost:5173"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASSWORD="smtp-password"
MAIL_FROM="DealFlow360 <quotes@example.com>"
```

Use `SMTP_SECURE="true"` for an implicit-TLS SMTP port such as 465. Keep it `false` for STARTTLS ports such as 587.

When `SMTP_HOST` is empty, sharing still succeeds and the quotation appears in the customer's portal, but the API reports `emailDelivery.status` as `SKIPPED`. This makes local development possible without pretending an email was delivered.

The customer flow is:

1. The customer creates a portal account using their email address.
2. The rep enters that email when sending an approved quotation.
3. The backend links the customer and emails `/portal/quotations/:quotationId`.
4. If the customer is signed out, the portal sends them to login and then returns them to the quotation.
