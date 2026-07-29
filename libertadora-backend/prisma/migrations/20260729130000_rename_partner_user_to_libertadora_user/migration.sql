-- RenameTable
ALTER TABLE "LibertadoraPartnerUser" RENAME TO "LibertadoraUser";

-- RenameConstraint
ALTER TABLE "LibertadoraUser" RENAME CONSTRAINT "LibertadoraPartnerUser_pkey" TO "LibertadoraUser_pkey";

-- RenameIndex
ALTER INDEX "LibertadoraPartnerUser_email_key" RENAME TO "LibertadoraUser_email_key";

-- AlterTable
ALTER TABLE "LibertadoraUser" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
