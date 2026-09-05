const express = require("express");
const controller = require("../controllers/negotiationController");
const { authenticateCustomer } = require("../middleware/customerAuth");
const { portalMutationLimiter } = require("../middleware/rateLimits");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticateCustomer);
router.get("/quotations", asyncHandler(controller.listPortalQuotations));
router.get("/quotations/:id", asyncHandler(controller.getPortalQuotation));
router.post(
  "/quotations/:id/comments",
  portalMutationLimiter,
  asyncHandler(controller.createCustomerComment),
);
router.put(
  "/quotations/:id/lines/:lineId/discount",
  portalMutationLimiter,
  asyncHandler(controller.updateCustomerDiscount),
);
router.post(
  "/quotations/:id/confirm",
  portalMutationLimiter,
  asyncHandler(controller.confirmCustomerRequest),
);

module.exports = router;
