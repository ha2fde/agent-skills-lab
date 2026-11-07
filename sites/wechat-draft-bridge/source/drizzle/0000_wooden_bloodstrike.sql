CREATE TABLE `wechat_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`label` text DEFAULT '我的公众号' NOT NULL,
	`secret_cipher` text NOT NULL,
	`relay_url` text DEFAULT '' NOT NULL,
	`relay_key_cipher` text DEFAULT '' NOT NULL,
	`token_cipher` text,
	`token_expires` integer DEFAULT 0 NOT NULL,
	`verified_at` text,
	`last_error` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wechat_images` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`media_id` text,
	`url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wechat_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_hash` text NOT NULL,
	`state` text NOT NULL,
	`result` text,
	`created_at` text NOT NULL
);
