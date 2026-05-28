CREATE TABLE "system_config" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");
