const express = require("express");
const { runDue } = require("../controllers/scrapeController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return res.status(500).json({
      error: "CRON_SECRET is not configured",
    });
  }

  const provided = req.get("x-cron-secret") || req.query.secret;

  if (provided !== expected) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  next();
}

router.post("/run", requireCronSecret, asyncHandler(runDue));

module.exports = router;
