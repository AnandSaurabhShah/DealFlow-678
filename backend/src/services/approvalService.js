const { FINANCE_THRESHOLD } = require("./quotationCalculator");

function getInitialApprovalStatus(score) {
  if (score.isZero()) return "APPROVED";
  if (score.greaterThan(FINANCE_THRESHOLD)) return "PENDING_FINANCE_APPROVAL";
  return "PENDING_MANAGER_APPROVAL";
}

function hasManagerApproval(quotation) {
  const currentRound = quotation.approvalRound || 0;
  return (quotation.approvalLogs || []).some(
    (log) => (log.approvalRound || 0) === currentRound &&
      log.action === "APPROVED" && log.actor?.role === "MANAGER",
  );
}

function getRequiredApproverRole(quotation) {
  if (quotation.status === "PENDING_MANAGER_APPROVAL") return "MANAGER";
  if (quotation.status === "PENDING_FINANCE_APPROVAL") {
    return hasManagerApproval(quotation) ? "FINANCE" : "MANAGER";
  }
  return null;
}

function getStatusAfterApproval(quotation, actorRole) {
  const approvalStatus = actorRole === "FINANCE"
    ? "APPROVED"
    : quotation.blendedRiskScore.greaterThan(FINANCE_THRESHOLD)
      ? "PENDING_FINANCE_APPROVAL"
      : "APPROVED";

  // Approval before a quote is shared makes it ready for the customer.
  // Approval after the customer accepts negotiated terms finalizes the quote.
  return approvalStatus === "APPROVED" && quotation.sentToCustomerAt
    ? "CONFIRMED"
    : approvalStatus;
}

module.exports = {
  getInitialApprovalStatus,
  getRequiredApproverRole,
  getStatusAfterApproval,
  hasManagerApproval,
};
