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

El respaldo usa `VACUUM INTO`, valida `PRAGMA integrity_check` sobre la copia y conserva 30 copias recientes más una muestra mensual. Define `BACKUP_EXTERNO_RUTA` y `BACKUP_EXTERNO_CLAVE` (base64 de 32 bytes) apuntando a un volumen externo para conservar una segunda copia cifrada y verificada. La restauración acepta copias `.db` o `.db.enc`, se niega si no se indica `--confirmar` o si la copia no es íntegra.

Con `RUN_CRON=true`, el respaldo se ejecuta diariamente a las 23:30 y la revisión operativa cada hora. Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERTA_FROM` y `ALERTA_TO` para enviar alertas por correo. La revisión alerta ante respaldo ausente/atrasado, errores elevados y disco por encima del 80 %.

## MFA TOTP

Los roles `RRHH_SUP`, `DIRECCION` y `ADMIN_TI` deben completar TOTP antes de acceder al sistema desde:

1. `POST /api/auth/mfa/setup` con el token vigente.
2. Registrar el `otpauth` en una aplicación autenticadora.
3. `POST /api/auth/mfa/verify` con `{ "code": "123456" }`.

El primer inicio devuelve un token limitado de enrolamiento (`mfaSetupRequired`); ese token no permite consultar módulos de negocio. Una vez confirmado, el inicio de sesión exige el campo `otp`. El secreto nunca se registra en auditoría ni en logs.

## Búsqueda y rotación de claves

La búsqueda de empleados usa FTS5 y sincroniza únicamente nombres y apellidos mediante triggers. No se indexan DNI ni campos cifrados. Para rotar `CLAVE_CIFRADO`, realizar una migración controlada de los campos cifrados antes de reiniciar la aplicación; nunca reemplazar la clave sin recifrar los datos.

## Reprocesos

Para corregir asistencia, primero modificar los marcajes o registros con el flujo autorizado, cerrar el día y ejecutar el consolidado. Después refrescar las proyecciones. Los períodos de planilla cerrados permanecen inmutables; cualquier diferencia se corrige con un período de ajuste.
