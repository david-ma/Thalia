PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_albums` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`description` text,
	`name` text NOT NULL,
	`privacy` text NOT NULL,
	`url` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_albums`("id", "created_at", "updated_at", "description", "name", "privacy", "url", "password") SELECT "id", "created_at", "updated_at", "description", "name", "privacy", "url", "password" FROM `albums`;--> statement-breakpoint
DROP TABLE `albums`;--> statement-breakpoint
ALTER TABLE `__new_albums` RENAME TO `albums`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_audits` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_id` text,
	`ip` text NOT NULL,
	`session_id` text,
	`action` text NOT NULL,
	`blob` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`sid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_audits`("id", "created_at", "updated_at", "user_id", "ip", "session_id", "action", "blob", "timestamp") SELECT "id", "created_at", "updated_at", "user_id", "ip", "session_id", "action", "blob", "timestamp" FROM `audits`;--> statement-breakpoint
DROP TABLE `audits`;--> statement-breakpoint
ALTER TABLE `__new_audits` RENAME TO `audits`;--> statement-breakpoint
CREATE TABLE `__new_fruit` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`taste` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_fruit`("id", "created_at", "updated_at", "name", "color", "taste") SELECT "id", "created_at", "updated_at", "name", "color", "taste" FROM `fruit`;--> statement-breakpoint
DROP TABLE `fruit`;--> statement-breakpoint
ALTER TABLE `__new_fruit` RENAME TO `fruit`;--> statement-breakpoint
CREATE TABLE `__new_images` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`caption` text,
	`album_id` text NOT NULL,
	`filename` text NOT NULL,
	`url` text NOT NULL,
	`original_size` integer NOT NULL,
	`original_width` integer NOT NULL,
	`original_height` integer NOT NULL,
	`thumbnail_url` text NOT NULL,
	`archived_uri` text NOT NULL,
	`archived_size` integer NOT NULL,
	`archived_md5` text NOT NULL,
	`image_key` text NOT NULL,
	`preferred_display_file_extension` text NOT NULL,
	`uri` text NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_images`("id", "created_at", "updated_at", "caption", "album_id", "filename", "url", "original_size", "original_width", "original_height", "thumbnail_url", "archived_uri", "archived_size", "archived_md5", "image_key", "preferred_display_file_extension", "uri") SELECT "id", "created_at", "updated_at", "caption", "album_id", "filename", "url", "original_size", "original_width", "original_height", "thumbnail_url", "archived_uri", "archived_size", "archived_md5", "image_key", "preferred_display_file_extension", "uri" FROM `images`;--> statement-breakpoint
DROP TABLE `images`;--> statement-breakpoint
ALTER TABLE `__new_images` RENAME TO `images`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`photo` text,
	`role` text DEFAULT 'user' NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`verified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "created_at", "updated_at", "name", "email", "password", "photo", "role", "locked", "verified") SELECT "id", "created_at", "updated_at", "name", "email", "password", "photo", "role", "locked", "verified" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;