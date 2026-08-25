-- Ciclo de revocacion: las autorizaciones ahora distinguen OTORGAR de REVOCAR.
ALTER TABLE "AutorizacionRol" ADD COLUMN "accion" TEXT NOT NULL DEFAULT 'OTORGAR';

CREATE INDEX "AutorizacionRol_accion_idx" ON "AutorizacionRol"("accion");
