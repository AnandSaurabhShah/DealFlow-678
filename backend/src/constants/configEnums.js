const definitions = {
  productCategories: [
    ["HARDWARE", "Hardware"],
    ["SERVICE", "Service"],
    ["SOFTWARE", "Software"],
    ["FULFILLMENT_DEMO", "Fulfillment demo"],
  ],
  productUnits: [
    ["UNIT", "Unit"],
    ["SERVICE", "Service"],
    ["SEAT_PER_MONTH", "Seat / month"],
  ],
  customerTiers: [
    ["STANDARD", "Standard"],
    ["SILVER", "Silver"],
    ["GOLD", "Gold"],
  ],
  currencies: [["USD", "USD"]],
  billingTypes: [
    ["ONE_TIME", "One-time"],
    ["RECURRING", "Recurring"],
  ],
  billingCycles: [["MONTHLY", "Monthly"]],
  userRoles: [
    ["REP", "Sales rep"],
    ["MANAGER", "Sales manager"],
    ["FINANCE", "Finance"],
  ],
};

const aliases = {
  productCategories: { DEVICES: "HARDWARE", "FULFILLMENT DEMO": "FULFILLMENT_DEMO" },
  productUnits: {
    "SEAT/MONTH": "SEAT_PER_MONTH",
    "SEAT / MONTH": "SEAT_PER_MONTH",
    "3": "UNIT",
    "8": "UNIT",
  },
};

function valuesFor(key) {
  return definitions[key].map(([value]) => value);
}

function enumValue(value, field, key) {
  const normalized = String(value).trim().toUpperCase();
  const canonical = aliases[key]?.[normalized] || normalized.replace(/[ -]+/g, "_");
  const allowed = valuesFor(key);
  if (!allowed.includes(canonical)) {
    const error = new Error(`${field} must be one of: ${allowed.join(", ")}`);
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return canonical;
}

function publicConfigOptions() {
  return Object.fromEntries(
    Object.entries(definitions).map(([key, options]) => [
      key,
      options.map(([value, label]) => ({ value, label })),
    ]),
  );
}

function matchingValues(key, search) {
  const term = String(search).trim().toLowerCase();
  if (!term) return [];
  return definitions[key]
    .filter(([value, label]) => value.toLowerCase().includes(term) || label.toLowerCase().includes(term))
    .map(([value]) => value);
}

module.exports = { enumValue, matchingValues, publicConfigOptions, valuesFor };
