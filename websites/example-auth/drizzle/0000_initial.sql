CREATE TABLE `albums` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`description` text,
	`name` varchar(255),
	`privacy` varchar(255),
	`url` varchar(255),
	`password` varchar(255),
	CONSTRAINT `albums_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`user_id` int,
	`ip` varchar(255) NOT NULL,
	`session_id` varchar(255),
	`action` varchar(255) NOT NULL,
	`blob` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fruit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`taste` text NOT NULL,
	CONSTRAINT `fruit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`caption` text,
	`album_id` int,
	`filename` varchar(255),
	`url` varchar(255),
	`original_size` int,
	`original_width` int,
	`original_height` int,
	`thumbnail_url` varchar(255),
	`archived_uri` varchar(255),
	`archived_size` int,
	`archived_md5` varchar(255),
	`image_key` varchar(255) NOT NULL,
	`preferred_display_file_extension` varchar(255),
	`uri` varchar(255),
	CONSTRAINT `images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mail` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`from` varchar(500),
	`to` varchar(1000),
	`cc` varchar(1000),
	`bcc` varchar(1000),
	`subject` varchar(1000),
	`text` text,
	`html` text,
	CONSTRAINT `mail_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sid` varchar(255) NOT NULL,
	`expires` timestamp,
	`data` json,
	`user_id` int,
	`logged_out` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_sid` PRIMARY KEY(`sid`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp DEFAULT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`photo` text,
	`role` varchar(255) NOT NULL DEFAULT 'user',
	`locked` boolean NOT NULL DEFAULT false,
	`verified` boolean NOT NULL DEFAULT false,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_session_id_sessions_sid_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`sid`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `images` ADD CONSTRAINT `images_album_id_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;