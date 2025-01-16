const { Pool } = require("pg");
require("dotenv").config();
const fs = require("fs");

const pool = new Pool({
  // host: "postgres-db.caprover.cueballdash.com",
  // host: 'https://pg-admin.caprover.cueballdash.com',
  host: "testing-new-postgres.caprover-testing.mtechub.com",
  port: 5432,
  user: "rimshariaz",
  password: "mtechub123",
  // database: "cueballs",
  database: "cueball-ph2-fronend",

  max: 10,
});

async function getBallImages() {
  try {
    const result = await pool.query("SELECT * FROM balls_images"); // replace with your actual SQL query
    const rows = result.rows;

    const ballImageUrls = {};
    for (let row of rows) {
      ballImageUrls[row.name] = row.image_url; // replace 'number' and 'url' with your actual column names
    }
    return ballImageUrls;
  } catch (error) {
    console.error(error);
  }
}
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to database:", err);
  } else {
    console.log("Connected to database successfully");

    release();
  }
});

const initSql = fs.readFileSync("app/models/init.sql").toString();

pool.query(initSql, (err, result) => {
  if (!err) {
    console.log("All Database tables Initialilzed successfully : ");
    // console.log(result)
  } else {
    console.log("Error Occurred While Initializing Database tables");
    console.log(err);
  }
});

module.exports = { pool, getBallImages };
