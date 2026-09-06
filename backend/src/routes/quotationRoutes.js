const express = require("express");
const controller = require("../controllers/quotationController");
const negotiationController = require("../controllers/negotiationController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate);
router.get("/", asyncHandler(controller.listQuotations));
router.get(
  "/pending",
  authorize("MANAGER", "FINANCE"),
  asyncHandler(controller.listPendingApprovals),
);
router.get("/:id/history", asyncHandler(controller.getQuotationHistory));
router.post(
  "/:id/send-to-customer",
  authorize("REP", "MANAGER", "ADMIN"),
  asyncHandler(negotiationController.sendToCustomer),
);
router.get("/:id/comments", asyncHandler(negotiationController.getInternalComments));
router.post(
  "/:id/comments",
  authorize("REP", "MANAGER", "ADMIN"),
  asyncHandler(negotiationController.createInternalComment),
);
router.get(
  "/:id/fulfillment/suggest",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.suggestFulfillment),
);
router.post(
  "/:id/fulfillment/confirm",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.confirmFulfillment),
);
router.get(
  "/:id/fulfillment/backorder-check",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.checkFulfillmentBackorder),
);
router.get("/:id", asyncHandler(controller.getQuotation));
router.post("/", authorize("REP", "ADMIN"), asyncHandler(controller.createQuotation));
router.put("/:id", authorize("REP", "ADMIN"), asyncHandler(controller.replaceQuotationLines));
router.post("/:id/confirm", authorize("REP", "ADMIN"), asyncHandler(controller.confirmQuotation));
router.post(
  "/:id/approve",
  authorize("MANAGER", "FINANCE"),
  asyncHandler(controller.approveQuotation),
);
router.post(
  "/:id/reject",
  authorize("MANAGER", "FINANCE"),
  asyncHandler(controller.rejectQuotation),
);
router.post(
  "/:id/return",
  authorize("MANAGER", "FINANCE"),
  asyncHandler(controller.returnQuotation),
);

module.exports = router;
