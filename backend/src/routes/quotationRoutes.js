const express = require("express");
const controller = require("../controllers/quotationController");
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
router.post("/", authorize("REP"), asyncHandler(controller.createQuotation));
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
