CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`description` text,
	`name` text NOT NULL,
	`privacy` text NOT NULL,
	`url` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE TABLE `fruit` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`taste` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE TABLE `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`expires` text NOT NULL,
	`data` text,
	`user_id` text,
	`logged_out` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
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
