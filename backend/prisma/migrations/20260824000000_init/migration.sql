-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcceso" TIMESTAMP(3),
    "mfaSecret" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "nivelAutoridad" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoSistema" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "PermisoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "rolId" INTEGER NOT NULL,
    "permisoId" INTEGER NOT NULL,

    CONSTRAINT "RolPermiso_pkey" PRIMARY KEY ("rolId","permisoId")
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "usuarioId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "scopeDepartamentoId" INTEGER,
    "asignadoPorId" INTEGER,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("usuarioId","rolId")
);

-- CreateTable
CREATE TABLE "AutorizacionRol" (
    "id" SERIAL NOT NULL,
    "beneficiarioId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "scopeDepartamentoId" INTEGER,
    "solicitadaPorId" INTEGER NOT NULL,
    "autorizadaPorId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADA',
    "motivo" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEn" TIMESTAMP(3),
    "venceEn" TIMESTAMP(3),
    "consumidaEn" TIMESTAMP(3),

    CONSTRAINT "AutorizacionRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolIncompatibilidadExcepcion" (
    "id" SERIAL NOT NULL,
    "rolAId" INTEGER NOT NULL,
    "rolBId" INTEGER NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RolIncompatibilidadExcepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionRefresh" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadoEn" TIMESTAMP(3),
    "motivoRevoca" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionRefresh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Puesto" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "rolSugerido" TEXT,
    "departamento_id" INTEGER NOT NULL,

    CONSTRAINT "Puesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "puesto_id" INTEGER NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "dni_hmac" TEXT,
    "fecha_ingreso" TIMESTAMP(3) NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "contacto_emergencia" TEXT,
    "telefono_emergencia" TEXT,
    "rtn" TEXT,
    "fecha_nacimiento" TIMESTAMP(3),
    "sexo" TEXT,
    "numero_ihss_cif" TEXT,
    "numero_rap_cif" TEXT,
    "banco" TEXT,
    "cuenta_bancaria_cif" TEXT,
    "jefe_id" INTEGER,
    "estadoLaboral" TEXT NOT NULL DEFAULT 'ACTIVO',
    "causaSalida" TEXT,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "modalidad" TEXT NOT NULL,
    "salarioBaseCent" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'HNL',
    "periodicidad" TEXT NOT NULL,
    "aplicaIhss" BOOLEAN NOT NULL DEFAULT true,
    "aplicaRap" BOOLEAN NOT NULL DEFAULT true,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "documentoRuta" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "departamentoId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionProyecto" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "porcentajeDedicacion" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsignacionProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialLaboral" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT NOT NULL,
    "motivo" TEXT,
    "autorizadoPor" INTEGER,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialLaboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoEmpleado" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoPor" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,
    "cruzaMedianoche" BOOLEAN NOT NULL DEFAULT false,
    "toleranciaMin" INTEGER NOT NULL DEFAULT 10,
    "minutosAlmuerzo" INTEGER NOT NULL DEFAULT 60,
    "diasSemana" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioEmpleado" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3),

    CONSTRAINT "HorarioEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marcaje" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "ocurridoEn" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'WEB',
    "dispositivo" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "registradoPor" INTEGER,
    "hashEvento" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Marcaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAsistencia" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "turnoId" INTEGER,
    "horaEntrada" TIMESTAMP(3),
    "horaSalida" TIMESTAMP(3),
    "minutosTrabajados" INTEGER NOT NULL DEFAULT 0,
    "minutosTardanza" INTEGER NOT NULL DEFAULT 0,
    "horasExtraDiurnas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasExtraNocturnas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estadoDia" TEXT NOT NULL,
    "permisoId" INTEGER,
    "vacacionId" INTEGER,
    "observacion" TEXT,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "cerradoPor" INTEGER,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "RegistroAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaFeriado" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'NACIONAL',
    "remunerado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiaFeriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoPermiso" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "remunerado" BOOLEAN NOT NULL DEFAULT true,
    "diasMaxAnio" INTEGER,
    "requiereSoporte" BOOLEAN NOT NULL DEFAULT false,
    "baseLegal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudPermiso" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "tipoPermisoId" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "diasHabiles" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "soporteRuta" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADO',
    "revisadoPor" INTEGER,
    "revisadoEn" TIMESTAMP(3),
    "observacionRevision" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoHistorialEstado" (
    "id" SERIAL NOT NULL,
    "permisoId" INTEGER NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT,
    "ip" TEXT,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermisoHistorialEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroLegal" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "unidad" TEXT,
    "descripcion" TEXT,
    "baseLegal" TEXT,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "creadoPor" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParametroLegal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoVacacional" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "anioServicio" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "diasDerecho" INTEGER NOT NULL,
    "diasGozados" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diasPagados" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoVacacional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudVacacion" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "periodoId" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "diasHabiles" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADO',
    "suplenteId" INTEGER,
    "revisadoPor" INTEGER,
    "revisadoEn" TIMESTAMP(3),
    "observacionRevision" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudVacacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacacionHistorialEstado" (
    "id" SERIAL NOT NULL,
    "vacacionId" INTEGER NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT,
    "ip" TEXT,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacacionHistorialEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoSaldoVacacion" (
    "id" SERIAL NOT NULL,
    "periodoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "dias" DOUBLE PRECISION NOT NULL,
    "referenciaId" INTEGER,
    "motivo" TEXT,
    "registradoPor" INTEGER,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoSaldoVacacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nomina" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fin" TIMESTAMP(3) NOT NULL,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "salario_bruto" DECIMAL(65,30) NOT NULL,
    "deducciones" DECIMAL(65,30) NOT NULL,
    "salario_neto" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Nomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concepto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "gravableIsr" BOOLEAN NOT NULL DEFAULT true,
    "afectaIhss" BOOLEAN NOT NULL DEFAULT true,
    "formulaClave" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Concepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoPlanilla" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "periodicidad" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "periodoAjusteDeId" INTEGER,
    "totalBrutoCent" INTEGER NOT NULL DEFAULT 0,
    "totalDeduccionesCent" INTEGER NOT NULL DEFAULT 0,
    "totalNetoCent" INTEGER NOT NULL DEFAULT 0,
    "totalAportesPatronalesCent" INTEGER NOT NULL DEFAULT 0,
    "calculadoPor" INTEGER,
    "calculadoEn" TIMESTAMP(3),
    "errorCalculo" TEXT,
    "cerradoPor" INTEGER,
    "cerradoEn" TIMESTAMP(3),
    "hashCierre" TEXT,
    "pagadoPor" INTEGER,
    "pagadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoPlanilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetallePlanilla" (
    "id" SERIAL NOT NULL,
    "periodoId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "contratoSnapshot" TEXT NOT NULL,
    "parametrosSnapshot" TEXT NOT NULL,
    "diasTrabajados" DOUBLE PRECISION NOT NULL,
    "horasExtra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIngresosCent" INTEGER NOT NULL,
    "totalDeduccionesCent" INTEGER NOT NULL,
    "totalAportesPatronalesCent" INTEGER NOT NULL DEFAULT 0,
    "netoPagarCent" INTEGER NOT NULL,
    "reciboRuta" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetallePlanilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaConcepto" (
    "id" SERIAL NOT NULL,
    "detalleId" INTEGER NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "baseCalculoCent" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION,
    "montoCent" INTEGER NOT NULL,
    "detalleCalculo" TEXT NOT NULL,

    CONSTRAINT "LineaConcepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER,
    "accion" TEXT NOT NULL,
    "antes" TEXT,
    "despues" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyeccionAsistenciaMensual" (
    "id" TEXT NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "departamentoId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "diasPresente" INTEGER NOT NULL,
    "diasAusente" INTEGER NOT NULL,
    "diasTardanza" INTEGER NOT NULL,
    "minutosTardanza" INTEGER NOT NULL,
    "pctAusentismo" DOUBLE PRECISION NOT NULL,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProyeccionAsistenciaMensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyeccionCostoPlanilla" (
    "id" TEXT NOT NULL,
    "departamentoId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "empleados" INTEGER NOT NULL,
    "totalBrutoCent" INTEGER NOT NULL,
    "totalDeduccionesCent" INTEGER NOT NULL,
    "totalNetoCent" INTEGER NOT NULL,
    "totalAportesCent" INTEGER NOT NULL,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProyeccionCostoPlanilla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_estado_idx" ON "Usuario"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_codigo_key" ON "Rol"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "PermisoSistema_codigo_key" ON "PermisoSistema"("codigo");

-- CreateIndex
CREATE INDEX "AutorizacionRol_beneficiarioId_rolId_estado_idx" ON "AutorizacionRol"("beneficiarioId", "rolId", "estado");

-- CreateIndex
CREATE INDEX "AutorizacionRol_estado_idx" ON "AutorizacionRol"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "SesionRefresh_tokenHash_key" ON "SesionRefresh"("tokenHash");

-- CreateIndex
CREATE INDEX "SesionRefresh_usuarioId_revocadoEn_idx" ON "SesionRefresh"("usuarioId", "revocadoEn");

-- CreateIndex
CREATE INDEX "SesionRefresh_familiaId_idx" ON "SesionRefresh"("familiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_nombre_key" ON "Departamento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Puesto_titulo_key" ON "Puesto"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuario_id_key" ON "Empleado"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_dni_key" ON "Empleado"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_dni_hmac_key" ON "Empleado"("dni_hmac");

-- CreateIndex
CREATE INDEX "Empleado_estadoLaboral_idx" ON "Empleado"("estadoLaboral");

-- CreateIndex
CREATE INDEX "Contrato_empleado_id_vigenciaDesde_idx" ON "Contrato"("empleado_id", "vigenciaDesde");

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_codigo_key" ON "Proyecto"("codigo");

-- CreateIndex
CREATE INDEX "Proyecto_departamentoId_activo_idx" ON "Proyecto"("departamentoId", "activo");

-- CreateIndex
CREATE INDEX "AsignacionProyecto_empleadoId_desde_hasta_idx" ON "AsignacionProyecto"("empleadoId", "desde", "hasta");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionProyecto_proyectoId_empleadoId_desde_key" ON "AsignacionProyecto"("proyectoId", "empleadoId", "desde");

-- CreateIndex
CREATE INDEX "HistorialLaboral_empleado_id_registradoEn_idx" ON "HistorialLaboral"("empleado_id", "registradoEn");

-- CreateIndex
CREATE INDEX "DocumentoEmpleado_empleado_id_tipo_idx" ON "DocumentoEmpleado"("empleado_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "HorarioEmpleado_empleadoId_desde_key" ON "HorarioEmpleado"("empleadoId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "Marcaje_hashEvento_key" ON "Marcaje"("hashEvento");

-- CreateIndex
CREATE INDEX "Marcaje_empleadoId_ocurridoEn_idx" ON "Marcaje"("empleadoId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "Marcaje_ocurridoEn_idx" ON "Marcaje"("ocurridoEn");

-- CreateIndex
CREATE INDEX "RegistroAsistencia_fecha_estadoDia_idx" ON "RegistroAsistencia"("fecha", "estadoDia");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_empleadoId_fecha_key" ON "RegistroAsistencia"("empleadoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "DiaFeriado_fecha_key" ON "DiaFeriado"("fecha");

-- CreateIndex
CREATE INDEX "Solicitud_empleado_id_estado_idx" ON "Solicitud"("empleado_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "TipoPermiso_codigo_key" ON "TipoPermiso"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudPermiso_folio_key" ON "SolicitudPermiso"("folio");

-- CreateIndex
CREATE INDEX "SolicitudPermiso_empleadoId_estado_idx" ON "SolicitudPermiso"("empleadoId", "estado");

-- CreateIndex
CREATE INDEX "SolicitudPermiso_estado_creadoEn_idx" ON "SolicitudPermiso"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "SolicitudPermiso_fechaInicio_fechaFin_idx" ON "SolicitudPermiso"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "PermisoHistorialEstado_permisoId_ocurridoEn_idx" ON "PermisoHistorialEstado"("permisoId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "ParametroLegal_clave_vigenciaDesde_idx" ON "ParametroLegal"("clave", "vigenciaDesde");

-- CreateIndex
CREATE INDEX "ParametroLegal_vigenciaDesde_vigenciaHasta_idx" ON "ParametroLegal"("vigenciaDesde", "vigenciaHasta");

-- CreateIndex
CREATE INDEX "PeriodoVacacional_empleadoId_estado_idx" ON "PeriodoVacacional"("empleadoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoVacacional_empleadoId_anioServicio_key" ON "PeriodoVacacional"("empleadoId", "anioServicio");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudVacacion_folio_key" ON "SolicitudVacacion"("folio");

-- CreateIndex
CREATE INDEX "SolicitudVacacion_empleadoId_estado_idx" ON "SolicitudVacacion"("empleadoId", "estado");

-- CreateIndex
CREATE INDEX "SolicitudVacacion_estado_creadoEn_idx" ON "SolicitudVacacion"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "SolicitudVacacion_fechaInicio_fechaFin_idx" ON "SolicitudVacacion"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "VacacionHistorialEstado_vacacionId_ocurridoEn_idx" ON "VacacionHistorialEstado"("vacacionId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "MovimientoSaldoVacacion_periodoId_ocurridoEn_idx" ON "MovimientoSaldoVacacion"("periodoId", "ocurridoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Concepto_codigo_key" ON "Concepto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoPlanilla_codigo_key" ON "PeriodoPlanilla"("codigo");

-- CreateIndex
CREATE INDEX "PeriodoPlanilla_estado_fechaPago_idx" ON "PeriodoPlanilla"("estado", "fechaPago");

-- CreateIndex
CREATE INDEX "PeriodoPlanilla_fechaInicio_fechaFin_idx" ON "PeriodoPlanilla"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "DetallePlanilla_empleadoId_idx" ON "DetallePlanilla"("empleadoId");

-- CreateIndex
CREATE UNIQUE INDEX "DetallePlanilla_periodoId_empleadoId_key" ON "DetallePlanilla"("periodoId", "empleadoId");

-- CreateIndex
CREATE INDEX "LineaConcepto_detalleId_idx" ON "LineaConcepto"("detalleId");

-- CreateIndex
CREATE INDEX "Notificacion_empleado_id_leida_idx" ON "Notificacion"("empleado_id", "leida");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_ocurridoEn_idx" ON "Auditoria"("usuarioId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "ProyeccionAsistenciaMensual_departamentoId_anio_mes_idx" ON "ProyeccionAsistenciaMensual"("departamentoId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ProyeccionAsistenciaMensual_empleadoId_anio_mes_key" ON "ProyeccionAsistenciaMensual"("empleadoId", "anio", "mes");

-- CreateIndex
CREATE INDEX "ProyeccionCostoPlanilla_anio_mes_idx" ON "ProyeccionCostoPlanilla"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ProyeccionCostoPlanilla_departamentoId_anio_mes_key" ON "ProyeccionCostoPlanilla"("departamentoId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "PermisoSistema"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_scopeDepartamentoId_fkey" FOREIGN KEY ("scopeDepartamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionRefresh" ADD CONSTRAINT "SesionRefresh_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puesto" ADD CONSTRAINT "Puesto_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "Puesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionProyecto" ADD CONSTRAINT "AsignacionProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionProyecto" ADD CONSTRAINT "AsignacionProyecto_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialLaboral" ADD CONSTRAINT "HistorialLaboral_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEmpleado" ADD CONSTRAINT "DocumentoEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioEmpleado" ADD CONSTRAINT "HorarioEmpleado_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioEmpleado" ADD CONSTRAINT "HorarioEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcaje" ADD CONSTRAINT "Marcaje_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "SolicitudPermiso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_vacacionId_fkey" FOREIGN KEY ("vacacionId") REFERENCES "SolicitudVacacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPermiso" ADD CONSTRAINT "SolicitudPermiso_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPermiso" ADD CONSTRAINT "SolicitudPermiso_tipoPermisoId_fkey" FOREIGN KEY ("tipoPermisoId") REFERENCES "TipoPermiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoHistorialEstado" ADD CONSTRAINT "PermisoHistorialEstado_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "SolicitudPermiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoVacacional" ADD CONSTRAINT "PeriodoVacacional_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudVacacion" ADD CONSTRAINT "SolicitudVacacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudVacacion" ADD CONSTRAINT "SolicitudVacacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoVacacional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudVacacion" ADD CONSTRAINT "SolicitudVacacion_suplenteId_fkey" FOREIGN KEY ("suplenteId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacacionHistorialEstado" ADD CONSTRAINT "VacacionHistorialEstado_vacacionId_fkey" FOREIGN KEY ("vacacionId") REFERENCES "SolicitudVacacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoSaldoVacacion" ADD CONSTRAINT "MovimientoSaldoVacacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoVacacional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomina" ADD CONSTRAINT "Nomina_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoPlanilla" ADD CONSTRAINT "PeriodoPlanilla_periodoAjusteDeId_fkey" FOREIGN KEY ("periodoAjusteDeId") REFERENCES "PeriodoPlanilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePlanilla" ADD CONSTRAINT "DetallePlanilla_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoPlanilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePlanilla" ADD CONSTRAINT "DetallePlanilla_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaConcepto" ADD CONSTRAINT "LineaConcepto_detalleId_fkey" FOREIGN KEY ("detalleId") REFERENCES "DetallePlanilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaConcepto" ADD CONSTRAINT "LineaConcepto_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyeccionAsistenciaMensual" ADD CONSTRAINT "ProyeccionAsistenciaMensual_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyeccionCostoPlanilla" ADD CONSTRAINT "ProyeccionCostoPlanilla_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

