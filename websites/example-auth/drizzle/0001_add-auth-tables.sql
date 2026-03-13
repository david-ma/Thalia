ALTER TABLE `albums` ADD `album_key` varchar(255);--> statement-breakpoint
ALTER TABLE `albums` ADD `url_name` varchar(255);--> statement-breakpoint
ALTER TABLE `albums` ADD `uri` varchar(255);--> statement-breakpoint
ALTER TABLE `albums` ADD `web_uri` varchar(255);--> statement-breakpoint
ALTER TABLE `albums` ADD `date_added` varchar(255);--> statement-breakpoint
ALTER TABLE `albums` ADD `date_modified` varchar(255);--> statement-breakpoint
ALTER TABLE `images` ADD `album_key` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `password_reset_token` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `password_reset_expires` timestamp;