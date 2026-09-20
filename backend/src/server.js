require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`[SERVER] API listening on port ${PORT}`);
});
