# MetaPeer

MetaPeer es una plataforma web para la **evaluación peer-to-peer** de prácticas (especialmente de programación) en entornos académicos. Permite gestionar asignaturas y tareas, cargar entregas en ZIP, asignar revisiones de forma automática, revisar con rúbricas y comentarios sobre el código por línea, y exportar calificaciones.

## Stack y arquitectura

- **Backend**: Node.js + Express, autenticación **JWT**, base de datos **SQLite** (`better-sqlite3`), subida de ficheros con `multer`.
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
- Variables opcionales adicionales (no están en el `.env.example`):
  - `JWT_SECRET` (si no existe se usa `demo-secret-key`)

> Nota: el frontend llama al backend en `http://127.0.0.1:4000/api`. Si cambias el puerto, actualiza `frontend/src/api.js` (y `frontend/src/pages/Export.jsx`).

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

## Base de datos y datos de demo

- La base de datos es **SQLite** y se guarda en `backend/data.sqlite`.
- El esquema se aplica automáticamente desde `backend/schema.sql`.
- Al arrancar el backend se ejecuta un *seed* que crea usuarios demo si no existen:

| Rol | Email | Password |
|---|---|---|
| Admin | `admin@demo` | `admin123` |
| Profesor | `prof@demo` | `prof123` |
| Alumno | `alum@demo` | `alum123` |

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

## Entregas en ZIP (cómo funciona)

- El backend acepta un **ZIP “lote”** (por ejemplo, exportado por una plataforma docente) que contiene ZIPs de entrega dentro de carpetas.
- El servidor recorre el contenido, detecta los ZIPs y trata de asociarlos a equipos por nombre/código de carpeta.
- Los ficheros se almacenan y descomprimen en `backend/deliveries/<assignmentId>/<teamId>/contenido`.

## Calificaciones y exportación

Endpoint de exportación: `GET /api/export/grades?assignmentId=...&format=csv` (roles `ADMIN`/`PROF`).

El CSV incluye:
- `nota_entrega`: media de las notas recibidas (peer review) para la entrega.
- `bonus_review`: media de meta-revisiones del profesor (`meta_revision.nota_final`) sobre el alumno como revisor (solo informativo).
- `nota_final`: igual a `nota_entrega` (sin ponderación fija global 80/20).

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
- `GET /api/reviews/:reviewId/meta` (ADMIN/PROF)
- `POST /api/reviews/:reviewId/meta` (ADMIN/PROF)

Otros:
- `GET /api/health`
- `GET /api/profile` (ADMIN/PROF)
- `GET /api/profiles/:userId/events` (ADMIN)


