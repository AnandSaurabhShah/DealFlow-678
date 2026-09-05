export function fulfillmentErrorMessage(error, fallback = 'Unable to process fulfillment') {
  if (!error.response) return 'Unable to reach the server. Check your connection and try again.'
  const code = error.response.data?.error?.code
  if (error.response.status === 403) return "You don't have permission to fulfill this quotation."
  if (error.response.status === 404) return 'This quotation could not be found.'
  if (code === 'INVALID_QUOTATION_STATUS') return 'This quotation is no longer eligible for fulfillment.'
  if (code === 'FULFILLMENT_OVER_ALLOCATION') return 'Allocated quantity exceeds the quantity ordered for one or more products.'
  if (code === 'INSUFFICIENT_STOCK') return 'Stock changed since this suggestion was generated. Refresh the suggested allocation and try again.'
  if (code === 'INVALID_FULFILLMENT_SPLIT') return 'The allocation is incomplete or contains duplicate warehouse and product rows.'
  if (code === 'INVALID_REFERENCE') return 'One or more selected warehouses are no longer available.'
  if (error.response.status >= 500) return 'The server could not complete fulfillment. Please try again.'
  return error.response.data?.error?.message || error.message || fallback
}
