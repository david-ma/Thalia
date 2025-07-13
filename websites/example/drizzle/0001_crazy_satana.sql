ALTER TABLE `albums` MODIFY COLUMN `deleted_at` timestamp DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `audits` MODIFY COLUMN `deleted_at` timestamp DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `fruit` MODIFY COLUMN `deleted_at` timestamp DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `images` MODIFY COLUMN `deleted_at` timestamp DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `mail` MODIFY COLUMN `deleted_at` timestamp DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `deleted_at` timestamp DEFAULT NULL;