// reset-db.js - Script to reset the Neon database
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function resetDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined");
    }

    console.log("Connecting to database...");
    const connection = postgres(process.env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    console.log("⏳ Resetting database...");
    const start = Date.now();

    // Truncate all tables in the correct order (due to foreign key constraints)
    await db.execute(sql`TRUNCATE TABLE votes, messages, chats CASCADE`);

    const end = Date.now();
    console.log("✅ Database reset completed in", end - start, "ms");

    // Close the connection
    await connection.end();
    console.log("Connection closed. Database has been reset successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database reset failed");
    console.error(error);
    process.exit(1);
  }
}

// Run the reset function
resetDatabase();
