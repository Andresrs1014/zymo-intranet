-- CreateTable
CREATE TABLE "SigLibertadoraBackup" (
    "id" SERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigLibertadoraBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigLibertadoraBackup_entity_externalId_idx" ON "SigLibertadoraBackup"("entity", "externalId");

-- CreateIndex
CREATE INDEX "SigLibertadoraBackup_createdAt_idx" ON "SigLibertadoraBackup"("createdAt");
