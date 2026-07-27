-- Ticket puede tener varios analistas simultaneos (antes: analyst/analystEmail
-- singulares). Se agregan las columnas array, se migran los datos existentes,
-- y se eliminan las columnas viejas -- un solo modelo de datos, sin dos rutas
-- de lectura conviviendo.

-- AlterTable: agregar columnas nuevas
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "analysts" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "analystEmails" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: tickets existentes con un analyst/analystEmail unico pasan a
-- array de 1 elemento. analystEmail se normaliza a minusculas para que el
-- filtro "asignado a mi" (analystEmails.has(email)) compare igual que antes
-- (el campo viejo usaba comparacion case-insensitive).
UPDATE "ZymoPqrTicket" SET "analysts" = ARRAY["analyst"] WHERE "analyst" IS NOT NULL;
UPDATE "ZymoPqrTicket" SET "analystEmails" = ARRAY[LOWER("analystEmail")] WHERE "analystEmail" IS NOT NULL;

-- AlterTable: eliminar columnas viejas
ALTER TABLE "ZymoPqrTicket" DROP COLUMN "analyst";
ALTER TABLE "ZymoPqrTicket" DROP COLUMN "analystEmail";
