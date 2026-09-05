const express = require("express");
const controller = require("../controllers/configController");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/config-options", asyncHandler(controller.getConfigOptions));

// Reps need authenticated catalog reads for the Phase 4 quotation builder.
router.get("/products", asyncHandler(controller.listProducts));
router.get("/products/:id", asyncHandler(controller.getProduct));

const adminOnly = authorize("ADMIN");

router.post("/products", adminOnly, asyncHandler(controller.createProduct));
router
  .route("/pricelists")
  .get(adminOnly, asyncHandler(controller.listPriceLists))
  .post(adminOnly, asyncHandler(controller.createPriceList));
router.get("/pricelists/:id", adminOnly, asyncHandler(controller.getPriceList));
router
  .route("/warehouses")
  .get(adminOnly, asyncHandler(controller.listWarehouses))
  .post(adminOnly, asyncHandler(controller.createWarehouse));
router.get("/warehouses/:id", adminOnly, asyncHandler(controller.getWarehouse));
router.post(
  "/warehouses/:id/restock",
  adminOnly,
  asyncHandler(controller.restockWarehouse),
);
router
  .route("/discount-tiers")
  .get(adminOnly, asyncHandler(controller.listDiscountTiers))
  .post(adminOnly, asyncHandler(controller.createDiscountTier));
router.get("/discount-tiers/:id", adminOnly, asyncHandler(controller.getDiscountTier));

module.exports = router;
