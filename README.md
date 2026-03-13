# MetaPeer

MetaPeer es una plataforma web para la **evaluación peer-to-peer** de prácticas (especialmente de programación) en entornos académicos. Permite gestionar asignaturas y tareas, cargar entregas en ZIP, asignar revisiones de forma automática, revisar con rúbricas y comentarios sobre el código por línea, y exportar calificaciones.

## Stack y arquitectura

- **Backend**: Node.js + Express, autenticación por **credenciales (email/contraseña)** con emisión de **JWT** para las peticiones autenticadas, base de datos **SQLite** (`better-sqlite3`), subida de ficheros con `multer`.
- **Frontend**: React + Vite, visor de entregas y revisión de código con **CodeMirror** (comentarios por línea, enlaces permanentes).
- **Estructura del repo**
  - `backend/`: API + BD + gestión de entregas (ZIP).
  - `frontend/`: aplicación web (UI).

## Requisitos

- Node.js **18+**
- npm

## Instalación

> Este repo no usa workspaces, pero el `postinstall` ya instala backend y frontend.

```powershell
# En la raíz del proyecto (instala todo)
npm install
```

## Configuración

Backend (`backend/.env`):

- Es opcional. Si no existe, el backend usa valores por defecto.
- `backend/.env.example` solo define:
  - `PORT` (por defecto `4000`)
  - `NODE_ENV` (`development` o `production`)
  - `SEED_DEMO_USERS` (`1` habilita seed demo en no-producción, `0` lo desactiva)
- Variables opcionales adicionales (no están en el `.env.example`):
  - `JWT_SECRET` (si no existe se usa `demo-secret-key`)

> Nota: el frontend llama al backend en `http://127.0.0.1:4000/api`. Si cambias host/puerto, actualiza `frontend/src/api.js` (`API_BASE`).

## Ejecutar en desarrollo

Desde la raíz (levanta backend + frontend en paralelo):

```powershell
npm run dev
```

Alternativa (en dos terminales):

```powershell
npm run dev:backend
npm run dev:frontend
```

- Backend: `http://127.0.0.1:4000`
- Frontend: Vite mostrará la URL en consola (habitualmente `http://127.0.0.1:5173`)

## Despliegue en servidor (producción)

`npm run dev` es solo para desarrollo. En producción:

1. **Instala dependencias** (raíz):
```bash
npm install
```

2. **Configura backend** (`backend/.env`), mínimo:
```env
NODE_ENV=production
SEED_DEMO_USERS=0
PORT=4000
JWT_SECRET=pon_aqui_una_clave_larga_y_unica
```

3. **Configura la URL del backend en frontend**:
- Edita `frontend/src/api.js` y ajusta `API_BASE` a tu host real (`https://tu-dominio/api` o `http://tu-ip:4000/api`).

4. **Compila frontend**:
```bash
npm --prefix frontend run build
```

5. **Arranca backend en modo producción**:
```bash
npm --prefix backend run start
```
- Recomendado: ejecutar con **PM2** o **systemd** para reinicio automático.

6. **Sirve `frontend/dist`**:
- Recomendado: **Nginx** o **Caddy**.
- Temporal: `npm --prefix frontend run preview` (no recomendado para producción real).

### Ejemplo rápido con Nginx

Config de servidor:
```nginx
server {
    listen 80;
    server_name tu-dominio-o-ip;

    root /ruta/a/MetaPeer/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Ejemplo rápido con Caddy

`Caddyfile`:
```caddy
tu-dominio-o-ip {
    root * /ruta/a/MetaPeer/frontend/dist
    file_server

    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    try_files {path} /index.html
}
```

### Notas operativas importantes

- El backend usa SQLite en `backend/data.sqlite` y también crea `data.sqlite-wal` y `data.sqlite-shm`.
- El usuario del proceso backend debe tener permisos de escritura en `backend/`.
- Si cambias `JWT_SECRET`, invalida tokens activos (los usuarios deberán volver a iniciar sesión).

## Base de datos y datos de demo

- La base de datos es **SQLite** y se guarda en `backend/data.sqlite`.
- El esquema se aplica automáticamente desde `backend/schema.sql`.
- Al arrancar el backend se ejecuta un *seed*. Los usuarios demo se crean según:
  - `SEED_DEMO_USERS=1`: se crean si no existen (solo fuera de producción).
  - `SEED_DEMO_USERS=0`: no se crean.
  - si no defines `SEED_DEMO_USERS`, por defecto se crean en no-producción.
- En `NODE_ENV=production`:
  - nunca se crean usuarios demo.
  - si no existe ningún `ADMIN`, se crea `admin@ucm` con contraseña aleatoria.
  - la credencial inicial se deja en `backend/tmp/pass-admin.txt` y también se imprime en consola.
  - elimina ese archivo tras el primer acceso por seguridad.

| Rol | Email | Password |
|---|---|---|
| Admin | `admin@demo` | `admin123` |
| Profesor | `prof@demo` | `prof123` |
| Alumno | `alum@demo` | `alum123` |

Scripts útiles de seed:

```powershell
npm run seed       # respeta NODE_ENV/SEED_DEMO_USERS
npm run seed:demo  # fuerza entorno de demo local
npm run seed:prod  # fuerza entorno de produccion (sin demo users)
```

Para resetear el entorno local: detén el backend y borra `backend/data.sqlite` (y si existen `backend/data.sqlite-wal`, `backend/data.sqlite-shm`), luego vuelve a iniciar.

## Flujo de uso (resumen)

**1) Administración (ADMIN)**
- Crea asignaturas.
- Importa alumnado/equipos desde CSV (*roster*) a una asignatura.
- Crea profesores y les asigna asignaturas.

**2) Profesorado (PROF)**
- Crea tareas (asociadas a una asignatura y con fecha de entrega).
- Define la **rúbrica** (criterios con pesos; la suma debe ser 100). Si no la modifica, se crea por defecto el criterio `Calidad general` al 100%.
- Sube un ZIP con entregas (el sistema detecta ZIPs por equipo, los almacena y los descomprime).
- Genera una **previsualización** de asignación de revisiones (equipo o individual) y la confirma.
- Consulta revisiones y realiza **meta-revisión** (nota final del profesor + observación sobre la revisión).
- Exporta calificaciones en CSV.

**3) Alumnado (ALUM)**
- Ve sus revisiones asignadas y revisa la entrega en un visor con árbol de archivos.
- Añade comentarios por línea sobre el código y completa la rúbrica. La nota final se calcula automáticamente según los pesos de la rúbrica (0..10).
- Consulta el **feedback** recibido por sus entregas.

## Casos de importación CSV (resumen)

- Cada importación CSV **reemplaza** los equipos internos de la asignatura (fuente de verdad).
- Si subes un CSV equivocado y luego uno correcto, la segunda importación sobrescribe miembros anteriores.
- Filas con `Individual`, `No está en un agrupamiento` o `No está en un grupo` no crean equipos y retiran al alumno de equipos.
- Tras importar, se sincronizan equipos en tareas de esa asignatura **solo si no tienen actividad** (sin entregas ni revisiones).
- Tareas con entregas o revisiones existentes no se modifican (se preserva el histórico).
- En asignaturas nuevas (o tareas nuevas sin actividad), al importar CSV se crean equipos de tarea y el botón de subir ZIP queda habilitado.

## Entregas en ZIP (cómo funciona)

- El backend acepta un **ZIP “lote”** (por ejemplo, exportado por una plataforma docente) que contiene ZIPs de entrega dentro de carpetas.
- El servidor recorre el contenido, detecta los ZIPs y trata de asociarlos a equipos por nombre/código de carpeta.
- Los ficheros se almacenan y descomprimen en `backend/deliveries/<assignmentId>/<teamId>/contenido`.

## Calificaciones y exportación

La UI de exportación genera dos CSV (roles `ADMIN`/`PROF`) a partir de estos endpoints:

- `GET /api/export/meta-outgoing?assignmentId=...`
- `GET /api/export/incoming-reviews?assignmentId=...`

Contenido (resumen):
- **Meta-revisión saliente**: alumno revisor, id de revisión, nota de meta-revisión, comentario.
- **Revisión entrante**: alumno autor, id de revisión, notas por criterio de rúbrica, nota global de rúbrica, comentario.

## API (resumen de endpoints)

Todas las rutas (salvo `/api/login`, `/api/health`) requieren cabecera `Authorization: Bearer <token>`.

Autenticación:
- `POST /api/login` → `{ token, user }`
- `GET /api/me` (JWT)

Asignaturas / administración:
- `POST /api/asignaturas` (ADMIN/PROF)
- `GET /api/asignaturas` (ADMIN/PROF)
- `POST /api/admin/import-roster` (ADMIN/PROF)
- `GET /api/admin/professors` (ADMIN)
- `POST /api/admin/professors` (ADMIN)
- `POST /api/admin/professors/:professorId/subjects` (ADMIN)

Tareas / rúbricas / asignación:
- `GET /api/assignments`
- `POST /api/assignments` (ADMIN/PROF)
- `GET /api/assignments/:assignmentId`
- `GET /api/assignments/:assignmentId/rubrica`
- `POST /api/assignments/:assignmentId/rubrica` (ADMIN/PROF)
- `POST /api/assignments/:assignmentId/assign` (ADMIN/PROF)
- `POST /api/assignments/:assignmentId/reset` (ADMIN/PROF)
- `GET /api/assignments/:assignmentId/assignment-summary` (ADMIN/PROF)
- `GET /api/assignments/:assignmentId/assignment-map` (ADMIN/PROF)

Entregas:
- `POST /api/submissions/upload-zip` (ADMIN/PROF) (multipart: `zipFile`)
- `GET /api/submissions?assignmentId=...`
- `GET /api/submissions/:submissionId/download`

Revisiones:
- `GET /api/my-review-tasks` (ALUM)
- `POST /api/reviews` (ALUM) (envía rúbrica/nota/comentario)
- `GET /api/reviews?submissionId=...`
- `GET /api/reviews/:revisionId/files`
- `GET /api/reviews/:revisionId/file?fileId=...`
- `GET /api/reviews/:revisionId/file/raw?fileId=...`
- `POST /api/reviews/:revisionId/comments` (ALUM) (comentarios por línea)
- `GET /api/reviews/:revisionId/file-comments`
- `POST /api/reviews/:revisionId/file-comments` (ALUM) (comentario general por fichero)
- `GET /api/reviews/:reviewId/meta` (ADMIN/PROF)
- `POST /api/reviews/:reviewId/meta` (ADMIN/PROF)

Otros:
- `GET /api/health`
- `GET /api/profile` (autenticado: ADMIN/PROF/ALUM)
- `GET /api/profiles/:userId/events` (ADMIN)

## Logs (JSONL)

El backend emite eventos de actividad en formato **JSON por línea** (JSONL). Esto facilita leerlos en consola y analizarlos después con scripts.

Campos base:
- `ts`: timestamp ISO (`new Date().toISOString()`).
- `event`: nombre del evento (`login_success`, etc.).
- `action`: acción técnica (`login`, etc.).
- `user_id`, `user_nombre`, `user_rol`: actor (si existe).
- `assignment_id`, `submission_id`, `review_id`: contexto (si aplica).
- `status`: normalmente `ok` o `error`.

Además, puede incluir `data` con campos extra del evento (por ejemplo `rows_count`, `line`, `has_comment`).

Para todos los roles:
- `login_success`: inicio de sesión correcto.
- `login_failed`: intento de login fallido.

ADMIN/PROF:
- `submission_batch_uploaded`: prof/admin subió un ZIP de entregas en lote.
- `review_opened_staff`: prof/admin abrió el árbol de archivos de una revisión puntual.
- `review_file_opened_staff`: prof/admin abrió un archivo concreto para revisarlo.
- `meta_review_submitted`: prof/admin registró una meta-revisión.
- `meta_review_updated`: prof/admin modificó una meta-revisión.
- `assignment_created`: prof/admin creó una tarea.
- `assignment_assigned_preview`: prof/admin generó previsualización de asignación.
- `assignment_assigned_confirmed`: prof/admin confirmó y guardó asignación.
- `assignment_reset`: prof/admin reseteó la asignación de revisiones.
- `roster_import_completed`: prof/admin terminó importación de roster CSV.
- `export_requested_meta_outgoing`: prof/admin pidió export de meta-revisión saliente.
- `export_requested_incoming_reviews`: prof/admin pidió export de revisiones entrantes.

ALUM:
- `review_workspace_opened`: el alumno abrió el árbol de archivos de una revisión.
- `review_file_opened`: el alumno abrió un archivo concreto para revisarlo.
- `line_comment_created`: el alumno añadió comentario por línea.
- `file_comment_created`: el alumno creó comentario general de archivo.
- `file_comment_updated`: el alumno actualizó comentario general de archivo.
- `review_submitted`: el alumno envió la revisión final (rúbrica + nota/comentario).
- `review_cycle_time_measured`: tiempo entre asignación de revisión y envío final.

Todos los eventos pueden aparecer con `status: "ok"` o `status: "error"`.


