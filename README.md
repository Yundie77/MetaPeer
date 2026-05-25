# MetaPeer

MetaPeer es una plataforma web para gestionar procesos de **evaluación por pares** en prácticas académicas, con especial atención a entregas de programación. Cubre el flujo completo de la actividad: gestión de asignaturas y usuarios, importación de alumnado y equipos, carga de entregas en ZIP, asignación automática de revisiones, revisión con rúbrica y comentarios sobre código, meta-revisión docente y exportación de calificaciones.

El proyecto se desarrolló como Trabajo de Fin de Grado y fue desplegado y probado con alumnado real en la asignatura **Visualización de Datos** de la Universidad Complutense de Madrid. Esa prueba debe entenderse como una primera validación funcional del sistema, no como una validación pedagógica concluyente.

## Características principales

- Roles diferenciados: `ADMIN`, `PROF` y `ALUM`.
- Gestión de asignaturas, profesorado, alumnado y equipos.
- Importación de alumnado/equipos desde CSV.
- Creación de tareas con fecha de entrega y rúbrica configurable.
- Carga de entregas mediante ZIP lote, con detección de ZIPs internos por equipo.
- Asignación de revisiones en modo `equipo` o `individual`, evitando auto-revisiones y equilibrando el reparto cuando las restricciones lo permiten.
- Visor de entregas con árbol de archivos y visualización de código.
- Comentarios generales por fichero y comentarios anclados a líneas de código.
- Cálculo de nota mediante criterios de rúbrica ponderados.
- Consulta del feedback recibido por el alumnado.
- Meta-revisión docente sobre el trabajo realizado por los revisores.
- Exportación de resultados en CSV.
- Registro estructurado de actividad en formato JSONL.

## Stack y arquitectura

MetaPeer sigue una arquitectura cliente-servidor ligera:

- **Frontend**: React + Vite, aplicación SPA y visor de código basado en CodeMirror.
- **Backend**: Node.js + Express, API REST, autenticación con JWT y procesamiento de entregas ZIP.
- **Persistencia**: SQLite mediante `better-sqlite3` para datos estructurados, y sistema de ficheros local para las entregas descomprimidas.

Estructura del repositorio:

```text
backend/   API, base de datos, rutas, seed y gestión de entregas
frontend/  aplicación web React
```

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

Este repositorio no usa npm workspaces, pero el `postinstall` de la raíz instala las dependencias de backend y frontend.

```powershell
npm install
```

## Configuración

El backend puede configurarse con `backend/.env`. Si el archivo no existe, se usan valores por defecto.

```env
PORT=4000
NODE_ENV=development
SEED_DEMO_USERS=1
JWT_SECRET=pon_aqui_una_clave_larga_y_unica
```

Variables relevantes:

- `PORT`: puerto del backend. Por defecto, `4000`.
- `NODE_ENV`: `development` o `production`.
- `SEED_DEMO_USERS`: `1` crea usuarios demo en desarrollo; `0` los desactiva.
- `JWT_SECRET`: clave de firma de JWT. Si no se define, se usa una clave de demo, no apta para producción.

El frontend llama por defecto a `http://127.0.0.1:4000/api`. Si cambias host, puerto o prefijo de despliegue, actualiza `API_BASE` en `frontend/src/api.js`.

## Ejecutar en desarrollo

Desde la raíz del proyecto:

```powershell
npm run dev
```

Esto levanta backend y frontend en paralelo.

También puedes arrancarlos por separado:

```powershell
npm run dev:backend
npm run dev:frontend
```

URLs habituales:

- Backend: `http://127.0.0.1:4000`
- Frontend: `http://127.0.0.1:5173`
- Salud del backend: `http://127.0.0.1:4000/api/health`

## Usuarios demo

En desarrollo, si `SEED_DEMO_USERS=1` o no se define explícitamente, el seed crea estos usuarios si no existen:

| Rol | Email | Password |
|---|---|---|
| Admin | `admin@demo` | `admin123` |
| Profesor | `prof@demo` | `prof123` |
| Alumno | `alum@demo` | `alum123` |

Scripts útiles:

```powershell
npm run seed       # respeta NODE_ENV/SEED_DEMO_USERS
npm run seed:demo  # fuerza usuarios demo en entorno local
npm run seed:prod  # fuerza entorno de producción sin usuarios demo
```

En `NODE_ENV=production` no se crean usuarios demo. Si no existe ningún `ADMIN`, el backend crea `admin@ucm` con una contraseña aleatoria, la imprime por consola y la guarda en `backend/tmp/pass-admin.txt`. Elimina ese archivo tras el primer acceso.

## Flujo de uso

**Administración (`ADMIN`)**

- Crea asignaturas.
- Importa alumnado y equipos desde CSV.
- Crea profesores y les asigna asignaturas.
- Puede ejecutar operaciones de recuperación, como reemplazar credenciales de usuarios existentes desde CSV.

**Profesorado (`PROF`)**

- Crea tareas asociadas a una asignatura.
- Define rúbricas con criterios ponderados. La suma de pesos debe ser 100.
- Sube entregas mediante ZIP lote.
- Genera una previsualización de asignaciones y la confirma.
- Consulta revisiones realizadas por el alumnado.
- Registra meta-revisiones.
- Exporta calificaciones y evidencias en CSV.

**Alumnado (`ALUM`)**

- Consulta sus revisiones asignadas.
- Navega por la entrega de otro equipo o alumno en el visor de archivos.
- Añade comentarios por línea y comentarios generales de fichero.
- Completa la rúbrica y envía la revisión.
- Consulta el feedback recibido sobre sus propias entregas.

## Importación CSV

La importación de alumnado y equipos se realiza desde la sección de gestión de grupos.

- Cada importación CSV reemplaza los equipos internos de la asignatura.
- Si se sube un CSV equivocado, una segunda importación correcta sobrescribe la anterior.
- Filas marcadas como `Individual`, `No está en un agrupamiento` o `No está en un grupo` no crean equipo y retiran al alumno de equipos.
- Tras importar, se sincronizan equipos en tareas de esa asignatura solo si no tienen actividad.
- Las tareas con entregas o revisiones existentes no se modifican, para preservar el histórico.

### Reemplazo de credenciales

Desde **Gestión Grupos** (`ADMIN`/`PROF`) existe una acción de recuperación para reemplazar credenciales con un CSV existente.

- El CSV debe tener dos columnas: `email;password`.
- Solo actualiza usuarios ya existentes.
- No crea usuarios nuevos ni modifica otros campos.
- Filas vacías o mal formadas se ignoran.
- La operación se ejecuta en una transacción y pide confirmación en la UI.

## Entregas ZIP

El backend acepta un ZIP lote, normalmente exportado desde una plataforma docente, que contiene ZIPs de entrega dentro de carpetas. El servidor recorre el contenido, detecta ZIPs internos y trata de asociarlos a equipos por nombre o código de carpeta.

Las entregas se almacenan y descomprimen en:

```text
backend/deliveries/<assignmentId>/<teamId>/contenido
```

Nota operativa: el procesamiento de ZIPs está pensado para un entorno académico controlado. En despliegues abiertos conviene reforzar límites de tamaño, profundidad de anidamiento y número de archivos extraídos.

## Calificaciones y exportación

La UI de exportación genera dos CSV para `ADMIN` y `PROF`:

- **Meta-revisión saliente**: alumno revisor, revisión, nota de meta-revisión y comentario docente.
- **Revisión entrante**: alumno autor, revisión, notas por criterio de rúbrica, nota global y comentario.

Endpoints:

- `GET /api/export/meta-outgoing?assignmentId=...`
- `GET /api/export/incoming-reviews?assignmentId=...`

## Base de datos y ficheros persistentes

- La base de datos SQLite se guarda en `backend/data.sqlite`.
- SQLite puede crear también `backend/data.sqlite-wal` y `backend/data.sqlite-shm`.
- El esquema se aplica desde `backend/schema.sql`.
- Las entregas se guardan bajo `backend/deliveries/`.
- El usuario del proceso backend debe tener permisos de escritura en `backend/`.

Para resetear un entorno local, detén el backend y elimina `backend/data.sqlite` junto con los archivos `data.sqlite-wal` y `data.sqlite-shm` si existen. Al arrancar de nuevo, se recreará el esquema.

## Despliegue

El despliegue descrito en la memoria corresponde a la prueba con alumnado real. MetaPeer se instaló en una máquina virtual con Ubuntu Linux 24.04 LTS, alojada en un servidor compartido del grupo de investigación e-UCM. La aplicación quedó accesible bajo el prefijo `/mp` dentro del dominio del servidor.

En ese entorno, frontend y backend se ejecutaron como servicios independientes gestionados con `systemd`:

- `mp-backend`: ejecuta `npm --prefix backend run start`.
- `mp-frontend`: ejecuta `npm --prefix frontend run preview`.

Ambos servicios se configuraron con reinicio automático (`Restart=always`), usuario no privilegiado `e-ucm`, `NODE_ENV=production` y la versión de Node.js instalada mediante `nvm`.

El ciclo de actualización se automatizó con un script de redespliegue preparado para la prueba. Ese script detenía los servicios, sincronizaba el repositorio, reinstalaba dependencias, reconstruía el frontend y arrancaba de nuevo la aplicación. Además, ajustaba el `index.html` generado por Vite para que los recursos estáticos se sirvieran correctamente bajo `/mp`.

Pasos base del despliegue:

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `backend/.env`:

```env
NODE_ENV=production
SEED_DEMO_USERS=0
PORT=4000
JWT_SECRET=pon_aqui_una_clave_larga_y_unica
```

3. Ajustar `API_BASE` en `frontend/src/api.js` al host real del backend.

4. Compilar el frontend:

```bash
npm --prefix frontend run build
```

5. Arrancar el backend:

```bash
npm --prefix backend run start
```

6. Arrancar el frontend compilado en modo preview:

```bash
npm --prefix frontend run preview
```

Si sirves la aplicación bajo un prefijo como `/mp`, comprueba también las rutas de assets generadas por Vite y la URL configurada en `API_BASE`.

## API

Todas las rutas salvo `/api/login` y `/api/health` requieren cabecera:

```http
Authorization: Bearer <token>
```

Autenticación:

- `POST /api/login`
- `GET /api/me`

Asignaturas y administración:

- `POST /api/asignaturas`
- `GET /api/asignaturas`
- `POST /api/admin/import-roster`
- `POST /api/admin/replace-credentials`
- `GET /api/admin/professors`
- `POST /api/admin/professors`
- `POST /api/admin/professors/:professorId/subjects`

Tareas, rúbricas y asignación:

- `GET /api/assignments`
- `POST /api/assignments`
- `GET /api/assignments/:assignmentId`
- `GET /api/assignments/:assignmentId/rubrica`
- `POST /api/assignments/:assignmentId/rubrica`
- `POST /api/assignments/:assignmentId/assign`
- `POST /api/assignments/:assignmentId/reset`
- `GET /api/assignments/:assignmentId/assignment-summary`
- `GET /api/assignments/:assignmentId/assignment-map`

Entregas:

- `POST /api/submissions/upload-zip`
- `GET /api/submissions?assignmentId=...`
- `GET /api/submissions/:submissionId/download`

Revisiones:

- `GET /api/my-review-tasks`
- `POST /api/reviews`
- `GET /api/reviews?submissionId=...`
- `GET /api/reviews/:revisionId/files`
- `GET /api/reviews/:revisionId/file?fileId=...`
- `GET /api/reviews/:revisionId/file/raw?fileId=...`
- `POST /api/reviews/:revisionId/comments`
- `GET /api/reviews/:revisionId/file-comments`
- `POST /api/reviews/:revisionId/file-comments`
- `GET /api/reviews/:reviewId/meta`
- `POST /api/reviews/:reviewId/meta`

Otros:

- `GET /api/health`
- `GET /api/profile`
- `GET /api/profiles/:userId/events`

## Trazabilidad

El backend emite eventos de actividad en formato JSON por línea. Cada evento incluye, cuando aplica:

- `ts`: timestamp ISO.
- `event`: nombre del evento.
- `action`: acción técnica.
- `user_id`, `user_nombre`, `user_rol`: actor.
- `assignment_id`, `submission_id`, `review_id`: contexto.
- `status`: `ok` o `error`.
- `data`: información adicional del evento.

Eventos destacados:

- `login_success`, `login_failed`
- `submission_batch_uploaded`
- `assignment_created`
- `assignment_assigned_preview`
- `assignment_assigned_confirmed`
- `assignment_reset`
- `roster_import_completed`
- `review_workspace_opened`
- `review_file_opened`
- `line_comment_created`
- `file_comment_created`
- `review_submitted`
- `review_cycle_time_measured`
- `meta_review_submitted`
- `meta_review_updated`
- `export_requested_meta_outgoing`
- `export_requested_incoming_reviews`

## Modo de desarrollo auxiliar

El frontend incluye un acceso rápido opcional para desarrollo mediante `frontend/public/quick-users.local.json`, usado para pruebas locales con distintos roles. No debe desplegarse como mecanismo de acceso en producción.

## Limitaciones conocidas y trabajo futuro

- La validación con usuarios se realizó en una única asignatura y una única tarea.
- No hubo grupo de control ni cuestionario formal de usabilidad.
- La meta-revisión docente no llegó a ejercitarse completamente durante el periodo analizado.
- Conviene ampliar la validación a más asignaturas y ciclos de revisión.
- Conviene robustecer el procesamiento de entregas ZIP frente a archivos grandes, anidamientos excesivos y entradas maliciosas.

## Licencia

Consulta [LICENSE](LICENSE).
