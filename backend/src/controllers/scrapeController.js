const { runDueScrapes } = require("../services/scrapeService");

async function runDue(req, res) {
  const result = await runDueScrapes();

  res.json(result);
}

module.exports = { runDue };
