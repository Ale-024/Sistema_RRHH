-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" DATETIME,
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcceso" DATETIME,
    "mfaSecret" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "PermisoSistema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "rolId" INTEGER NOT NULL,
    "permisoId" INTEGER NOT NULL,

    PRIMARY KEY ("rolId", "permisoId"),
    CONSTRAINT "RolPermiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "PermisoSistema" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "usuarioId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "scopeDepartamentoId" INTEGER,
    "asignadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("usuarioId", "rolId"),
    CONSTRAINT "UsuarioRol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsuarioRol_scopeDepartamentoId_fkey" FOREIGN KEY ("scopeDepartamentoId") REFERENCES "Departamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SesionRefresh" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "expiraEn" DATETIME NOT NULL,
    "revocadoEn" DATETIME,
    "motivoRevoca" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SesionRefresh_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "Puesto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "departamento_id" INTEGER NOT NULL,
    CONSTRAINT "Puesto_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "Departamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "puesto_id" INTEGER NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "dni_hmac" TEXT,
    "fecha_ingreso" DATETIME NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "contacto_emergencia" TEXT,
    "telefono_emergencia" TEXT,
    "rtn" TEXT,
    "fecha_nacimiento" DATETIME,
    "sexo" TEXT,
    "numero_ihss_cif" TEXT,
    "numero_rap_cif" TEXT,
    "banco" TEXT,
    "cuenta_bancaria_cif" TEXT,
    "jefe_id" INTEGER,
    "estadoLaboral" TEXT NOT NULL DEFAULT 'ACTIVO',
    "causaSalida" TEXT,
    CONSTRAINT "Empleado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Empleado_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "Puesto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "modalidad" TEXT NOT NULL,
    "salarioBaseCent" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'HNL',
    "periodicidad" TEXT NOT NULL,
    "aplicaIhss" BOOLEAN NOT NULL DEFAULT true,
    "aplicaRap" BOOLEAN NOT NULL DEFAULT true,
    "vigenciaDesde" DATETIME NOT NULL,
    "vigenciaHasta" DATETIME,
    "documentoRuta" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contrato_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistorialLaboral" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT NOT NULL,
    "motivo" TEXT,
    "autorizadoPor" INTEGER,
    "registradoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialLaboral_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentoEmpleado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoPor" INTEGER NOT NULL,
    "subidoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "fecha_hora_entrada" DATETIME NOT NULL,
    "fecha_hora_salida" DATETIME,
    "estado" TEXT NOT NULL,
    CONSTRAINT "Asistencia_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha_solicitud" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_inicio" DATETIME NOT NULL,
    "fecha_fin" DATETIME NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT "Solicitud_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nomina" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "periodo_inicio" DATETIME NOT NULL,
    "periodo_fin" DATETIME NOT NULL,
    "fecha_pago" DATETIME NOT NULL,
    "salario_bruto" DECIMAL NOT NULL,
    "deducciones" DECIMAL NOT NULL,
    "salario_neto" DECIMAL NOT NULL,
    CONSTRAINT "Nomina_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleado_id" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacion_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER,
    "accion" TEXT NOT NULL,
    "antes" TEXT,
    "despues" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "ocurridoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE UNIQUE INDEX "SesionRefresh_tokenHash_key" ON "SesionRefresh"("tokenHash");

-- CreateIndex
CREATE INDEX "SesionRefresh_usuarioId_revocadoEn_idx" ON "SesionRefresh"("usuarioId", "revocadoEn");

-- CreateIndex
CREATE INDEX "SesionRefresh_familiaId_idx" ON "SesionRefresh"("familiaId");

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
CREATE INDEX "HistorialLaboral_empleado_id_registradoEn_idx" ON "HistorialLaboral"("empleado_id", "registradoEn");

-- CreateIndex
CREATE INDEX "DocumentoEmpleado_empleado_id_tipo_idx" ON "DocumentoEmpleado"("empleado_id", "tipo");

-- CreateIndex
CREATE INDEX "Asistencia_fecha_hora_entrada_idx" ON "Asistencia"("fecha_hora_entrada");

-- CreateIndex
CREATE INDEX "Solicitud_empleado_id_estado_idx" ON "Solicitud"("empleado_id", "estado");

-- CreateIndex
CREATE INDEX "Notificacion_empleado_id_leida_idx" ON "Notificacion"("empleado_id", "leida");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_ocurridoEn_idx" ON "Auditoria"("usuarioId", "ocurridoEn");

