-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'custom',
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "encApiKey" TEXT NOT NULL DEFAULT '',
    "keyHint" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "preset" TEXT NOT NULL DEFAULT 'custom',
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 465,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "encPassword" TEXT NOT NULL,
    "appendSent" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "signature" TEXT NOT NULL DEFAULT '',
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "uidValidity" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'IN',
    "uid" INTEGER,
    "mailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT '',
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "to" TEXT NOT NULL DEFAULT '',
    "cc" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "priority" TEXT,
    "category" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "waMessageId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "replyToEmailId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'NEW',
    "recipients" TEXT NOT NULL DEFAULT '[]',
    "groupId" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT,
    "author" TEXT NOT NULL DEFAULT 'AI',
    "origin" TEXT NOT NULL DEFAULT 'DASHBOARD',
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "waMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","contactId")
);

-- CreateTable
CREATE TABLE "WaSession" (
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "emailId" TEXT,
    "draftId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaSession_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "WaProcessed" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaProcessed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_address_key" ON "EmailAccount"("address");

-- CreateIndex
CREATE INDEX "Email_accountId_receivedAt_idx" ON "Email"("accountId", "receivedAt");

-- CreateIndex
CREATE INDEX "Email_waMessageId_idx" ON "Email"("waMessageId");

-- CreateIndex
CREATE INDEX "Email_messageId_idx" ON "Email"("messageId");

-- CreateIndex
CREATE INDEX "Draft_status_idx" ON "Draft"("status");

-- CreateIndex
CREATE INDEX "Draft_waMessageId_idx" ON "Draft"("waMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_replyToEmailId_fkey" FOREIGN KEY ("replyToEmailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

