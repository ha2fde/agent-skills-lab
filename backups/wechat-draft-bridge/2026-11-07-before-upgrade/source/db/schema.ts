import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable("wechat_connections", {
  userId: text("user_id").primaryKey(),
  appId: text("app_id").notNull(),
  label: text("label").notNull().default("我的公众号"),
  secretCipher: text("secret_cipher").notNull(),
  relayUrl: text("relay_url").notNull().default(""),
  relayKeyCipher: text("relay_key_cipher").notNull().default(""),
  tokenCipher: text("token_cipher"),
  tokenExpires: integer("token_expires").notNull().default(0),
  verifiedAt: text("verified_at"),
  lastError: text("last_error"),
  updatedAt: text("updated_at").notNull(),
});
export const receipts = sqliteTable("wechat_receipts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), appId: text("app_id").notNull(),
  kind: text("kind").notNull(), payloadHash: text("payload_hash").notNull(), state: text("state").notNull(),
  result: text("result"), createdAt: text("created_at").notNull(),
});
export const images = sqliteTable("wechat_images", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), appId: text("app_id").notNull(),
  name: text("name").notNull(), purpose: text("purpose").notNull(), mediaId: text("media_id"), url: text("url"),
  createdAt: text("created_at").notNull(),
});
