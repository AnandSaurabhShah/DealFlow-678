export const defaultConfigOptions = {
  productCategories: [
    { value: 'HARDWARE', label: 'Hardware' },
    { value: 'SERVICE', label: 'Service' },
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'FULFILLMENT_DEMO', label: 'Fulfillment demo' },
  ],
  productUnits: [
    { value: 'UNIT', label: 'Unit' },
    { value: 'SERVICE', label: 'Service' },
    { value: 'SEAT_PER_MONTH', label: 'Seat / month' },
  ],
  customerTiers: [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'SILVER', label: 'Silver' },
    { value: 'GOLD', label: 'Gold' },
  ],
  currencies: [{ value: 'USD', label: 'USD' }],
  billingTypes: [
    { value: 'ONE_TIME', label: 'One-time' },
    { value: 'RECURRING', label: 'Recurring' },
  ],
  billingCycles: [{ value: 'MONTHLY', label: 'Monthly' }],
}

const labels = Object.fromEntries(
  Object.values(defaultConfigOptions).flat().map(option => [option.value, option.label]),
)

export function configEnumLabel(value) {
  if (!value) return '—'
  return labels[value] || String(value).replaceAll('_', ' ').toLowerCase().replace(/^./, char => char.toUpperCase())
}
