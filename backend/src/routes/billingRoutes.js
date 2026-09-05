const express = require("express");
const controller = require("../controllers/billingController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate);
router.get("/quotations/:id/billing", asyncHandler(controller.getQuotationBilling));
router.post(
  "/quotations/:id/billing/generate",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.generateQuotationBilling),
);
router.put(
  "/quotations/:id/lines/:lineId/quantity",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.updateRecurringQuantity),
);
router.post(
  "/quotations/:id/lines/:lineId/cancel",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.cancelRecurringLine),
);
router.post(
  "/invoices/:id/pay",
  authorize("REP", "ADMIN"),
  asyncHandler(controller.payInvoice),
);

module.exports = router;
