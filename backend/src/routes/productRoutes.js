const express = require("express");
const { search } = require("../controllers/productController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/search", asyncHandler(search));

module.exports = router;
