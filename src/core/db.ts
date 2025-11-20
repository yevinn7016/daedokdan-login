import { Pool } from "pg";
import { config } from "./config";

export const db = new Pool({
  connectionString: config.databaseUrl,
});

export async function testDBConnection() {
  const res = await db.query("SELECT NOW()");
  console.log("DB connected at", res.rows[0].now);
}
