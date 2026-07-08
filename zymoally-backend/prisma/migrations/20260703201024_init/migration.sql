-- CreateTable
CREATE TABLE "ZymoPqrTicket" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthKey" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "areaPrefix" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "platform" TEXT,
    "supervisor" TEXT,
    "analyst" TEXT,
    "coordinator" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "owner" TEXT,
    "date" TEXT NOT NULL,
    "dueDate" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "impact" TEXT,
    "channel" TEXT,
    "managementCriteria" TEXT,
    "closedDate" TEXT,
    "description" TEXT,

    CONSTRAINT "ZymoPqrTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoPqrAction" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" TEXT NOT NULL,

    CONSTRAINT "ZymoPqrAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoPqrEvidence" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "ZymoPqrEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoConfigList" (
    "id" SERIAL NOT NULL,
    "listType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ZymoConfigList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoAreaPrefix" (
    "id" SERIAL NOT NULL,
    "area" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ZymoAreaPrefix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoClientSurvey" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "nps" INTEGER NOT NULL,
    "npsCategory" TEXT NOT NULL,
    "satisfaction" INTEGER NOT NULL,
    "delivery" INTEGER NOT NULL,
    "attention" INTEGER NOT NULL,
    "meeting" INTEGER NOT NULL,
    "solution" INTEGER NOT NULL,
    "valuedAspect" TEXT,
    "issue" TEXT,
    "comment" TEXT,
    "nextStep" TEXT,

    CONSTRAINT "ZymoClientSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoExperienceSurvey" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "company" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "fit" TEXT,
    "futureValue" INTEGER NOT NULL,
    "clarity" TEXT,
    "exceededExpectations" TEXT,
    "actionToday" TEXT,
    "professionalSatisfaction" INTEGER NOT NULL,
    "meetingFit" INTEGER NOT NULL,
    "leadershipComment" TEXT,
    "satisfaction" INTEGER NOT NULL,
    "solution" INTEGER NOT NULL,
    "nextStep" TEXT,

    CONSTRAINT "ZymoExperienceSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZymoVisitReport" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "commercial" TEXT,
    "client" TEXT NOT NULL,
    "contact" TEXT,
    "outcome" TEXT,
    "nextDate" TEXT,
    "quality" INTEGER NOT NULL,
    "clientMood" INTEGER NOT NULL,
    "opportunity" INTEGER NOT NULL,
    "urgency" INTEGER NOT NULL,
    "observations" TEXT,
    "actionPlan" TEXT,

    CONSTRAINT "ZymoVisitReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZymoPqrTicket_code_key" ON "ZymoPqrTicket"("code");

-- CreateIndex
CREATE INDEX "ZymoPqrAction_ticketId_idx" ON "ZymoPqrAction"("ticketId");

-- CreateIndex
CREATE INDEX "ZymoPqrEvidence_ticketId_idx" ON "ZymoPqrEvidence"("ticketId");

-- CreateIndex
CREATE INDEX "ZymoConfigList_listType_idx" ON "ZymoConfigList"("listType");

-- CreateIndex
CREATE UNIQUE INDEX "ZymoConfigList_listType_value_key" ON "ZymoConfigList"("listType", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ZymoAreaPrefix_prefix_key" ON "ZymoAreaPrefix"("prefix");

-- AddForeignKey
ALTER TABLE "ZymoPqrAction" ADD CONSTRAINT "ZymoPqrAction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ZymoPqrTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZymoPqrEvidence" ADD CONSTRAINT "ZymoPqrEvidence_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ZymoPqrTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
