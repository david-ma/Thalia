PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audits` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`user_id` integer,
	`ip` text NOT NULL,
	`session_id` text,
	`action` text NOT NULL,
	`blob` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`sid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_audits`("id", "created_at", "updated_at", "deleted_at", "user_id", "ip", "session_id", "action", "blob", "timestamp") SELECT "id", "created_at", "updated_at", "deleted_at", "user_id", "ip", "session_id", "action", "blob", "timestamp" FROM `audits`;--> statement-breakpoint
DROP TABLE `audits`;--> statement-breakpoint
ALTER TABLE `__new_audits` RENAME TO `audits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;