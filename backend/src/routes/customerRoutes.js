const express = require("express");
const controller = require("../controllers/customerController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("REP", "ADMIN"), asyncHandler(controller.listCustomers));
router.post("/", authorize("ADMIN"), asyncHandler(controller.createCustomer));

module.exports = router;
