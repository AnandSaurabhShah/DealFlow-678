export function billingErrorMessage(error, fallback = 'Unable to update billing') {
  const code = error.response?.data?.error?.code
  const messages = {
    BILLING_ALREADY_GENERATED: 'Billing has already been generated. Refresh to see the latest records.',
    BILLING_NOT_GENERATED: 'Generate billing before changing this subscription.',
    INVALID_QUOTATION_STATUS: 'This quotation is not currently eligible for that billing action.',
    NO_PENDING_BILLING_CYCLE: 'There is no future billing cycle available for this adjustment.',
    NOT_RECURRING: 'This action is only available for recurring products.',
    SUBSCRIPTION_CANCELLED: 'This subscription has already been cancelled.',
    UNSUPPORTED_BILLING_CYCLE: 'This subscription uses an unsupported billing cycle.',
  }
  return messages[code] || error.response?.data?.error?.message || error.message || fallback
}

export function hasGeneratedBilling(billing) {
  if (!billing) return false
  return billing.oneTimeInvoices.length > 0 || billing.recurringLines.some(
    line => line.billingScheduleEntries.length > 0,
  )
}
