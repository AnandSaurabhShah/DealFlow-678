export function approvalErrorMessage(error, fallback) {
  const status = error.response?.status
  if (!error.response) return 'Unable to reach the server. Check your connection and try again.'
  if (status === 403) return 'You do not have permission to perform this approval action.'
  if (status === 404) return 'This quotation could not be found.'
  if (status === 409) return 'This quotation has changed. Refresh to see the latest status.'
  if (status === 422 || status === 400) {
    return error.response?.data?.error?.message || 'Check the information provided and try again.'
  }
  if (status >= 500) return 'The server could not complete this request. Please try again.'
  return error.response?.data?.error?.message || error.message || fallback
}

export const roleLabels = {
  REP: 'Sales Rep',
  MANAGER: 'Sales Manager',
  FINANCE: 'Finance',
  ADMIN: 'Administrator',
}

export const actionLabels = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned for Revision',
}
