const express = require("express");
const controller = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate, authorize("ADMIN"));
router.route("/")
  .get(asyncHandler(controller.listUsers))
  .post(asyncHandler(controller.createUser));

module.exports = router;
