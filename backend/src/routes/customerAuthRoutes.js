const express = require("express");
const controller = require("../controllers/customerAuthController");
const asyncHandler = require("../utils/asyncHandler");
const { customerAuthLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.use(customerAuthLimiter);
router.post("/signup", asyncHandler(controller.signup));
router.post("/login", asyncHandler(controller.login));

module.exports = router;
