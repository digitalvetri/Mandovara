-- Add ClientStatus enum and status field to Client model
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

ALTER TABLE "Client" ADD COLUMN "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE';
