const ApiError = require("../utils/apiError");
const {
  calculateBlendedRiskScore,
  calculateQuotationTotals,
} = require("./quotationCalculator");
const { getInitialApprovalStatus } = require("./approvalService");

async function loadActiveDiscountTier(db) {
  const standard = await db.discountTier.findUnique({
    where: { tierName: "Standard" },
    include: { categoryOverrides: true },
  });
  const tier = standard || await db.discountTier.findFirst({
    include: { categoryOverrides: true },
    orderBy: { createdAt: "asc" },
  });
  if (!tier) {
    throw new ApiError(
      409,
      "DISCOUNT_TIER_REQUIRED",
      "Configure one discount tier before submitting quotations",
    );
  }
  return tier;
}

async function evaluateGovernance(lines, db) {
  const discountTier = await loadActiveDiscountTier(db);
  const totals = calculateQuotationTotals(lines);
  const blendedRiskScore = calculateBlendedRiskScore(lines, discountTier);
  return {
    totals,
    blendedRiskScore,
    status: getInitialApprovalStatus(blendedRiskScore),
  };
}

module.exports = { loadActiveDiscountTier, evaluateGovernance };
