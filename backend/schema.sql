PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuario (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  correo           TEXT NOT NULL UNIQUE,
  nombre_completo  TEXT NOT NULL,
  rol              TEXT NOT NULL CHECK (rol IN ('ADMIN','PROF','ALUM')),
  contrasena_hash  TEXT,                    
  estado           TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','invitado','desactivado')),
  creado_en        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asignatura (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS usuario_asignatura (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario     INTEGER NOT NULL,         
  id_asignatura  INTEGER NOT NULL,
  UNIQUE (id_usuario, id_asignatura),
  FOREIGN KEY (id_usuario)    REFERENCES usuario(id)     ON DELETE CASCADE,
  FOREIGN KEY (id_asignatura) REFERENCES asignatura(id)  ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS tarea (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_asignatura         INTEGER,                            
  titulo                TEXT NOT NULL,
  descripcion           TEXT,
  fecha_entrega         TEXT,
  estado                TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('borrador','abierta','cerrada','archivada')),
  creado_por            INTEGER NOT NULL,                   -- usuario (PROF)
  FOREIGN KEY (id_asignatura) REFERENCES asignatura(id) ON DELETE SET NULL,
  FOREIGN KEY (creado_por)    REFERENCES usuario(id)     ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS equipo (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tarea  INTEGER NOT NULL,
  nombre    TEXT,                                         
  FOREIGN KEY (id_tarea) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS miembro_equipo (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  id_equipo  INTEGER NOT NULL,
  id_usuario INTEGER NOT NULL,                              -- (ALUM)
  UNIQUE (id_equipo, id_usuario),
  FOREIGN KEY (id_equipo) REFERENCES equipo(id)   ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS asignacion (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tarea               INTEGER NOT NULL UNIQUE,           -- 1:1 con tarea
  modo                   TEXT NOT NULL DEFAULT 'equipo' CHECK (modo IN ('equipo','individual')),
  revisores_por_entrega  INTEGER DEFAULT 1,
  bloqueada              INTEGER NOT NULL DEFAULT 0,
  fecha_asignacion       TEXT,
  FOREIGN KEY (id_tarea) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rubrica_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  id_asignacion INTEGER NOT NULL,
  clave_item    TEXT NOT NULL,                              -- ej. "item_1"
  texto         TEXT NOT NULL,
  peso          REAL NOT NULL DEFAULT 0.0,                  -- porcentaje 0..100
  UNIQUE (id_asignacion, clave_item),
  FOREIGN KEY (id_asignacion) REFERENCES asignacion(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS entregas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tarea    INTEGER NOT NULL,
  id_equipo   INTEGER NOT NULL,
  id_subidor  INTEGER NOT NULL,                             
  nombre_zip  TEXT NOT NULL,
  ruta_archivo TEXT NOT NULL,
  tamano_bytes INTEGER,
  fecha_subida TEXT NOT NULL,
  UNIQUE (id_tarea, id_equipo),                             -- una entrega por equipo y tarea
  FOREIGN KEY (id_tarea)   REFERENCES tarea(id)   ON DELETE CASCADE,
  FOREIGN KEY (id_equipo)  REFERENCES equipo(id)  ON DELETE CASCADE,
  FOREIGN KEY (id_subidor) REFERENCES usuario(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS carga_entregas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tarea      INTEGER NOT NULL,
  id_profesor   INTEGER NOT NULL,
  nombre_zip    TEXT NOT NULL,
  ruta_zip      TEXT NOT NULL,
  total_equipos INTEGER,
  fecha_subida  TEXT NOT NULL,
  FOREIGN KEY (id_tarea)    REFERENCES tarea(id)    ON DELETE CASCADE,
  FOREIGN KEY (id_profesor) REFERENCES usuario(id)  ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS revision (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  id_asignacion    INTEGER NOT NULL,                   
  id_entrega       INTEGER NOT NULL,                      
  id_revisores     INTEGER NOT NULL,                     
  ultimo_revisor   INTEGER,
  fecha_asignacion TEXT NOT NULL,
  fecha_envio      TEXT,
  respuestas_json  TEXT,                                    
  nota_numerica    REAL,
  comentario_extra TEXT,
  UNIQUE (id_entrega, id_revisores),                        -- una revisión por (entrega, equipo revisor)
  FOREIGN KEY (id_asignacion) REFERENCES asignacion(id) ON DELETE CASCADE,
  FOREIGN KEY (id_entrega)    REFERENCES entregas(id)  ON DELETE CASCADE,
  FOREIGN KEY (id_revisores)  REFERENCES equipo(id)    ON DELETE CASCADE,
  FOREIGN KEY (ultimo_revisor) REFERENCES usuario(id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS code_comment (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id   INTEGER NOT NULL,
  sha1          TEXT NOT NULL,
  ruta_archivo  TEXT NOT NULL,
  linea         INTEGER NOT NULL,
  contenido     TEXT NOT NULL,
  autor_id      INTEGER,
  creado_en     TEXT NOT NULL,
  FOREIGN KEY (revision_id) REFERENCES revision(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id)    REFERENCES usuario(id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS file_comment (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id   INTEGER NOT NULL,
  sha1          TEXT NOT NULL,
  ruta_archivo  TEXT NOT NULL,
  contenido     TEXT NOT NULL,
  autor_id      INTEGER,
  creado_en     TEXT NOT NULL,
  UNIQUE (revision_id, sha1, ruta_archivo),
  FOREIGN KEY (revision_id) REFERENCES revision(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id)    REFERENCES usuario(id)  ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS meta_revision (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tarea       INTEGER NOT NULL,
  id_entrega     INTEGER,                     
  id_revision    INTEGER,                                  
  id_profesor    INTEGER NOT NULL,                          -- usuario (PROF)
  nota_final     REAL,
  observacion    TEXT,
  fecha_registro TEXT NOT NULL,
  FOREIGN KEY (id_tarea)    REFERENCES tarea(id)      ON DELETE CASCADE,
  FOREIGN KEY (id_entrega)  REFERENCES entregas(id)   ON DELETE CASCADE,
  FOREIGN KEY (id_revision) REFERENCES revision(id)   ON DELETE CASCADE,
  FOREIGN KEY (id_profesor) REFERENCES usuario(id)    ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_usuario_asig_user   ON usuario_asignatura(id_usuario);
CREATE INDEX IF NOT EXISTS idx_usuario_asig_asig   ON usuario_asignatura(id_asignatura);

CREATE INDEX IF NOT EXISTS idx_tarea_asignatura    ON tarea(id_asignatura);
CREATE INDEX IF NOT EXISTS idx_tarea_creado_por    ON tarea(creado_por);

CREATE INDEX IF NOT EXISTS idx_equipo_tarea        ON equipo(id_tarea);
CREATE INDEX IF NOT EXISTS idx_miembro_equipo_eq   ON miembro_equipo(id_equipo);

CREATE INDEX IF NOT EXISTS idx_asignacion_tarea    ON asignacion(id_tarea);
CREATE INDEX IF NOT EXISTS idx_rubrica_asignacion  ON rubrica_items(id_asignacion);

CREATE INDEX IF NOT EXISTS idx_entregas_tarea      ON entregas(id_tarea);
CREATE INDEX IF NOT EXISTS idx_entregas_equipo     ON entregas(id_equipo);
CREATE INDEX IF NOT EXISTS idx_carga_entregas_tarea ON carga_entregas(id_tarea);
CREATE INDEX IF NOT EXISTS idx_carga_entregas_prof  ON carga_entregas(id_profesor);

CREATE INDEX IF NOT EXISTS idx_revision_entrega    ON revision(id_entrega);
CREATE INDEX IF NOT EXISTS idx_revision_revisores  ON revision(id_revisores);
CREATE INDEX IF NOT EXISTS idx_comment_revision    ON code_comment(revision_id);
CREATE INDEX IF NOT EXISTS idx_comment_sha1        ON code_comment(sha1);
CREATE INDEX IF NOT EXISTS idx_file_comment_revision ON file_comment(revision_id);
CREATE INDEX IF NOT EXISTS idx_file_comment_sha1     ON file_comment(sha1);
CREATE INDEX IF NOT EXISTS idx_file_comment_path     ON file_comment(ruta_archivo);

CREATE INDEX IF NOT EXISTS idx_meta_tarea          ON meta_revision(id_tarea);
CREATE INDEX IF NOT EXISTS idx_meta_entrega        ON meta_revision(id_entrega);
CREATE INDEX IF NOT EXISTS idx_meta_revision       ON meta_revision(id_revision);
