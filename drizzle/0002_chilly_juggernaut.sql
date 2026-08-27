CREATE TABLE `asternal_chat_members` (
	`chatId` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`role` enum('owner','member','admin','moderator') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`lastReadAt` timestamp,
	CONSTRAINT `asternal_chat_members_chatId_userOpenId_pk` PRIMARY KEY(`chatId`,`userOpenId`)
);
--> statement-breakpoint
CREATE TABLE `asternal_chat_messages` (
	`id` varchar(64) NOT NULL,
	`chatId` varchar(64) NOT NULL,
	`senderOpenId` varchar(64) NOT NULL,
	`content` text,
	`mediaUrl` text,
	`mediaType` varchar(24),
	`replyToId` varchar(64),
	`kind` varchar(32),
	`pollId` varchar(64),
	`giftId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asternal_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asternal_chat_poll_votes` (
	`pollId` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`optionIndex` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asternal_chat_poll_votes_pollId_userOpenId_optionIndex_pk` PRIMARY KEY(`pollId`,`userOpenId`,`optionIndex`)
);
--> statement-breakpoint
CREATE TABLE `asternal_chat_polls` (
	`id` varchar(64) NOT NULL,
	`chatId` varchar(64) NOT NULL,
	`createdByOpenId` varchar(64) NOT NULL,
	`question` varchar(300) NOT NULL,
	`options` json NOT NULL,
	`multiple` enum('false','true') NOT NULL DEFAULT 'false',
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `asternal_chat_polls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asternal_chats` (
	`id` varchar(64) NOT NULL,
	`type` enum('community','dm','group') NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`avatarUrl` text,
	`ownerOpenId` varchar(64) NOT NULL,
	`directKey` varchar(160),
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asternal_chats_id` PRIMARY KEY(`id`),
	CONSTRAINT `asternal_chats_directKey_unique` UNIQUE(`directKey`)
);
--> statement-breakpoint
CREATE TABLE `asternal_orb_gift_claims` (
	`giftId` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asternal_orb_gift_claims_giftId_userOpenId_pk` PRIMARY KEY(`giftId`,`userOpenId`)
);
--> statement-breakpoint
CREATE TABLE `asternal_orb_gifts` (
	`id` varchar(64) NOT NULL,
	`chatId` varchar(64) NOT NULL,
	`createdByOpenId` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`amountPerPerson` int NOT NULL,
	`maxClaims` int NOT NULL,
	`claims` int NOT NULL DEFAULT 0,
	`status` enum('open','closed','expired') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `asternal_orb_gifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `asternal_chat_members_user_idx` ON `asternal_chat_members` (`userOpenId`);--> statement-breakpoint
CREATE INDEX `asternal_chat_messages_chat_created_idx` ON `asternal_chat_messages` (`chatId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `asternal_chat_messages_sender_idx` ON `asternal_chat_messages` (`senderOpenId`);--> statement-breakpoint
CREATE INDEX `asternal_chat_poll_votes_poll_idx` ON `asternal_chat_poll_votes` (`pollId`);--> statement-breakpoint
CREATE INDEX `asternal_chat_polls_chat_idx` ON `asternal_chat_polls` (`chatId`);--> statement-breakpoint
CREATE INDEX `asternal_chats_type_updated_idx` ON `asternal_chats` (`type`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `asternal_chats_owner_idx` ON `asternal_chats` (`ownerOpenId`);--> statement-breakpoint
CREATE INDEX `asternal_orb_gifts_chat_status_idx` ON `asternal_orb_gifts` (`chatId`,`status`);