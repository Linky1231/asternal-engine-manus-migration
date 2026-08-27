CREATE TABLE `asternal_records` (
	`id` varchar(64) NOT NULL,
	`collection` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`visibility` enum('private','public') NOT NULL DEFAULT 'private',
	`data` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asternal_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `asternal_records_owner_collection_idx` ON `asternal_records` (`ownerOpenId`,`collection`);--> statement-breakpoint
CREATE INDEX `asternal_records_collection_visibility_idx` ON `asternal_records` (`collection`,`visibility`);