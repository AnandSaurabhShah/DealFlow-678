const { FINANCE_THRESHOLD } = require("./quotationCalculator");

function getInitialApprovalStatus(score) {
  if (score.isZero()) return "APPROVED";
  if (score.greaterThan(FINANCE_THRESHOLD)) return "PENDING_FINANCE_APPROVAL";
  return "PENDING_MANAGER_APPROVAL";
}

function hasManagerApproval(quotation) {
  return (quotation.approvalLogs || []).some(
    (log) => log.action === "APPROVED" && log.actor?.role === "MANAGER",
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
  if (actorRole === "FINANCE") return "APPROVED";
  return quotation.blendedRiskScore.greaterThan(FINANCE_THRESHOLD)
    ? "PENDING_FINANCE_APPROVAL"
    : "APPROVED";
}

module.exports = {
  getInitialApprovalStatus,
  getRequiredApproverRole,
  getStatusAfterApproval,
  hasManagerApproval,
};
