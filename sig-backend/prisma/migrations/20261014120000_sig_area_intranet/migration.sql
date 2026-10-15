-- Las carpetas (áreas) del SIG nacen de las áreas de la intranet: cada una enlaza con su área y trae sus cargos (solo lectura).
ALTER TABLE "SigArea" ADD COLUMN "intranetAreaId" INTEGER;
ALTER TABLE "SigArea" ADD COLUMN "cargos" JSONB NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX "SigArea_intranetAreaId_key" ON "SigArea"("intranetAreaId");
