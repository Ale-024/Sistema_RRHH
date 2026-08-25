-- Cambio de rol: la solicitud REVOCAR puede llevar un rol destino (rol base
-- que quedara tras ejecutar el cambio), para degradar en un solo acto.
ALTER TABLE "AutorizacionRol" ADD COLUMN "rolDestinoId" INTEGER;

CREATE INDEX "AutorizacionRol_rolDestinoId_idx" ON "AutorizacionRol"("rolDestinoId");
