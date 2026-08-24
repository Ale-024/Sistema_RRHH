# Manual operativo SIRH-MKT · Fase 7

## Salud y métricas

- Salud pública: `GET /api/salud` o `GET /v1/salud`.
- Métricas protegidas: `GET /api/metricas`; requiere `observabilidad:leer`.
- Cada solicitud emite una línea JSON con `requestId`, usuario, ruta, latencia y estado.

## Proyecciones y reportes

Las proyecciones de asistencia y costo se refrescan cada noche a las 02:30 cuando `RUN_CRON=true`.
También se puede ejecutar desde la interfaz autorizada o llamar `POST /api/admin/reportes/refrescar` con `reportes:administrar`.

Reportes disponibles en `/api/admin/reportes` y `/v1/reportes`:

- `asistencia`
- `ausentismo`
- `personal-por-proyecto`
- `costo-planilla` (solo `reportes:ver_global`)

El parámetro `formato` acepta `json`, `xlsx` o `pdf`. Los datos se filtran por departamento para gerencia y por el alcance efectivo de cada rol.

## Respaldar y restaurar

Desde `backend/`:

```text
npm run backup
npm run restore -- backups/sirh-YYYYMMDD-HHmm.db --confirmar
```

El respaldo usa `VACUUM INTO`, valida `PRAGMA integrity_check` sobre la copia y conserva 30 copias recientes más una muestra mensual. La restauración se niega si no se indica `--confirmar` o si la copia no es íntegra.

## MFA TOTP

Los roles `RRHH_SUP`, `DIRECCION` y `ADMIN_TI` pueden activar TOTP desde:

1. `POST /api/auth/mfa/setup` con el token vigente.
2. Registrar el `otpauth` en una aplicación autenticadora.
3. `POST /api/auth/mfa/verify` con `{ "code": "123456" }`.

Una vez confirmado, el inicio de sesión de esos roles exige el campo `otp`. El secreto nunca se registra en auditoría ni en logs.

## Búsqueda y rotación de claves

La búsqueda de empleados usa FTS5 y sincroniza nombres, apellidos y DNI mediante triggers. No se indexan campos cifrados. Para rotar `CLAVE_CIFRADO`, realizar una migración controlada de los campos cifrados antes de reiniciar la aplicación; nunca reemplazar la clave sin recifrar los datos.

## Reprocesos

Para corregir asistencia, primero modificar los marcajes o registros con el flujo autorizado, cerrar el día y ejecutar el consolidado. Después refrescar las proyecciones. Los períodos de planilla cerrados permanecen inmutables; cualquier diferencia se corrige con un período de ajuste.
