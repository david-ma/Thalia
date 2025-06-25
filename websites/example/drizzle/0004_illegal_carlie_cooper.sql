PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mail` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`from` text,
	`to` text,
	`subject` text,
	`text` text,
	`html` text
);
--> statement-breakpoint
INSERT INTO `__new_mail`("id", "created_at", "updated_at", "deleted_at", "from", "to", "subject", "text", "html") SELECT "id", "created_at", "updated_at", "deleted_at", "from", "to", "subject", "text", "html" FROM `mail`;--> statement-breakpoint
DROP TABLE `mail`;--> statement-breakpoint
ALTER TABLE `__new_mail` RENAME TO `mail`;--> statement-breakpoint
PRAGMA foreign_keys=ON;