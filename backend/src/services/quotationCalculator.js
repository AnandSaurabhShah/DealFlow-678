const { Prisma } = require("@prisma/client");

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

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

module.exports = { calculateLineTotal, calculateQuotationTotals };
