-- CreateTable
CREATE TABLE "SigAreaExcluida" (
    "intranetAreaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAreaExcluida_pkey" PRIMARY KEY ("intranetAreaId")
);
