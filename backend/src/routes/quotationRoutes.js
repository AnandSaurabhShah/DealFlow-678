const express = require("express");
const controller = require("../controllers/quotationController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate);
router.get("/", asyncHandler(controller.listQuotations));
router.get("/:id", asyncHandler(controller.getQuotation));
router.post("/", authorize("REP"), asyncHandler(controller.createQuotation));
router.put("/:id", authorize("REP", "ADMIN"), asyncHandler(controller.replaceQuotationLines));
router.post("/:id/confirm", authorize("REP", "ADMIN"), asyncHandler(controller.confirmQuotation));

module.exports = router;
