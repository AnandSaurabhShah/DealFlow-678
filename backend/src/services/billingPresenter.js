function shapeBillingResponse(quotation) {
  if (!quotation?.id) throw new TypeError("quotation.id is required");
  if (!Array.isArray(quotation.lines)) throw new TypeError("quotation.lines must be an array");
  if (!Array.isArray(quotation.invoices)) {
    throw new TypeError("quotation.invoices must be an array");
  }

  return {
    quotationId: quotation.id,
    customerName: quotation.customerName,
    status: quotation.status,
    oneTimeLines: quotation.lines.filter((line) => line.billingType === "ONE_TIME"),
    recurringLines: quotation.lines.filter((line) => line.billingType === "RECURRING"),
    oneTimeInvoices: quotation.invoices.filter((invoice) => invoice.type === "ONE_TIME"),
    recurringInvoices: quotation.invoices.filter((invoice) => invoice.type === "RECURRING"),
  };
}

module.exports = { shapeBillingResponse };
