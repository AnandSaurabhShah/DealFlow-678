const { Prisma } = require("@prisma/client");

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

// MVP 2 approval-routing thresholds. These remain constants until approval
// chain configuration is intentionally introduced in a later MVP.
const MANAGER_THRESHOLD = new Prisma.Decimal(1);
const FINANCE_THRESHOLD = new Prisma.Decimal(10);

function calculateLineTotal(line) {
  const unitPrice = new Prisma.Decimal(line.unitPrice);
  const discountPercent = new Prisma.Decimal(line.discountPercent || 0);
  const gross = unitPrice.mul(line.qty);
  const discount = gross.mul(discountPercent).div(ONE_HUNDRED);

  return {
    subtotal: gross,
    discount,
    lineTotal: gross.minus(discount),
  };
}

function calculateQuotationTotals(lines) {
  return lines.reduce(
    (totals, line) => {
      const calculated = calculateLineTotal(line);
      return {
        subtotal: totals.subtotal.plus(calculated.subtotal),
        totalDiscount: totals.totalDiscount.plus(calculated.discount),
        grandTotal: totals.grandTotal.plus(calculated.lineTotal),
      };
    },
    { subtotal: ZERO, totalDiscount: ZERO, grandTotal: ZERO },
  );
}

function resolveDiscountCeiling(category, discountTier) {
  if (!discountTier) throw new TypeError("discountTier is required");
  if (!category) throw new TypeError("line product category is required");

  const override = (discountTier.categoryOverrides || []).find(
    (item) => item.category === category,
  );
  return new Prisma.Decimal(
    override ? override.maxDiscountPercent : discountTier.maxDiscountPercent,
  );
}

function calculateLineDiscountExcess(line, discountTier) {
  const category = line.product?.category || line.category;
  const ceiling = resolveDiscountCeiling(category, discountTier);
  const discountPercent = new Prisma.Decimal(line.discountPercent || 0);

  return Prisma.Decimal.max(ZERO, discountPercent.minus(ceiling));
}

function calculateBlendedRiskScore(lines, discountTier) {
  return lines.reduce(
    (score, line) => score.plus(calculateLineDiscountExcess(line, discountTier)),
    ZERO,
  );
}

module.exports = {
  MANAGER_THRESHOLD,
  FINANCE_THRESHOLD,
  calculateLineTotal,
  calculateQuotationTotals,
  resolveDiscountCeiling,
  calculateLineDiscountExcess,
  calculateBlendedRiskScore,
};
