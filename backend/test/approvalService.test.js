const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const {
  getInitialApprovalStatus,
  getRequiredApproverRole,
  getStatusAfterApproval,
} = require("../src/services/approvalService");

test("routes zero, moderate, and high risk scores correctly", () => {
  assert.equal(getInitialApprovalStatus(new Prisma.Decimal(0)), "APPROVED");
  assert.equal(getInitialApprovalStatus(new Prisma.Decimal("0.5")), "PENDING_MANAGER_APPROVAL");
  assert.equal(getInitialApprovalStatus(new Prisma.Decimal(10)), "PENDING_MANAGER_APPROVAL");
  assert.equal(getInitialApprovalStatus(new Prisma.Decimal("10.01")), "PENDING_FINANCE_APPROVAL");
});

test("high-risk approval remains manager-first, then becomes finance-owned", () => {
  const quotation = {
    status: "PENDING_FINANCE_APPROVAL",
    blendedRiskScore: new Prisma.Decimal(12),
    approvalLogs: [],
  };
  assert.equal(getRequiredApproverRole(quotation), "MANAGER");
  assert.equal(getStatusAfterApproval(quotation, "MANAGER"), "PENDING_FINANCE_APPROVAL");

  quotation.approvalLogs.push({ action: "APPROVED", actor: { role: "MANAGER" } });
  assert.equal(getRequiredApproverRole(quotation), "FINANCE");
  assert.equal(getStatusAfterApproval(quotation, "FINANCE"), "APPROVED");
});

test("moderate risk becomes approved after manager approval", () => {
  const quotation = {
    status: "PENDING_MANAGER_APPROVAL",
    blendedRiskScore: new Prisma.Decimal(8),
    approvalLogs: [],
  };
  assert.equal(getRequiredApproverRole(quotation), "MANAGER");
  assert.equal(getStatusAfterApproval(quotation, "MANAGER"), "APPROVED");
});

test("final approval after customer acceptance confirms the quotation", () => {
  const quotation = {
    status: "PENDING_MANAGER_APPROVAL",
    blendedRiskScore: new Prisma.Decimal(8),
    sentToCustomerAt: new Date(),
    approvalLogs: [],
  };
  assert.equal(getStatusAfterApproval(quotation, "MANAGER"), "CONFIRMED");
});

test("does not reuse a manager approval from an earlier approval round", () => {
  const quotation = {
    status: "PENDING_FINANCE_APPROVAL",
    blendedRiskScore: new Prisma.Decimal(15),
    approvalRound: 2,
    approvalLogs: [
      { approvalRound: 1, action: "APPROVED", actor: { role: "MANAGER" } },
    ],
  };
  assert.equal(getRequiredApproverRole(quotation), "MANAGER");
  quotation.approvalLogs.push({
    approvalRound: 2,
    action: "APPROVED",
    actor: { role: "MANAGER" },
  });
  assert.equal(getRequiredApproverRole(quotation), "FINANCE");
});
