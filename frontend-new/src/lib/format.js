export const formatMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format

export const formatDate = value => new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

export const shortId = id => `Q-${id.slice(-8).toUpperCase()}`

export const formatDateOnly = value => new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
}).format(new Date(value))
