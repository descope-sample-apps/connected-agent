import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({
  path: ".env",
});

async function runMigrations() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined");
    }

    const connection = postgres(process.env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    console.log("⏳ Running migrations...");
    const start = Date.now();

    // Read and execute the initial migration
    const migrationPath = join(
      __dirname,
      "..",
      "..",
      "migrations",
      "0000_initial.sql"
    );
    const migration = readFileSync(migrationPath, "utf-8");

    // Split the migration into individual statements
    const statements = migration
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await db.execute(sql.raw(statement));
      console.log("Executed migration statement successfully");
    }

    const end = Date.now();
    console.log("✅ Migrations completed in", end - start, "ms");

    // Close the connection
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();
