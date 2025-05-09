import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";

// Define the chats table
export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at"),
  visibility: text("visibility").default("private").notNull(),
});

// Define the messages table
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  parts: jsonb("parts").notNull(),
  attachments: jsonb("attachments").default([]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define the votes table
export const votes = pgTable(
  "votes",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    isUpvoted: text("is_upvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

// Define the usage table
export const usage = pgTable("usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  monthlyLimit: integer("monthly_limit").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
