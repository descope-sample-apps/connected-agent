import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create a connection to the database
const connection = postgres(process.env.DATABASE_URL);

// Create a Drizzle ORM instance
export const db = drizzle(connection, { schema });

// Export the schema for use in other files
export { schema };
