# MetaPeer
MetaPeer: Sistema para la evaluación peer-to-peer de prácticas // MetaPeer: System for peer-to-peer practice assessment

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```powershell
cd peer-review-starter\backend
npm install
```

## Configuración

1. Copia el archivo `.env.example` a `.env` (opcional si queremos cambiar el puerto).
2. El archivo de base de datos `data.sqlite` se crea automáticamente al iniciar el servidor.

## Uso en desarrollo

```powershell
En los archivos backend y frontend ejecutar en dos terminales: 
npm run dev
```

El servidor se inicia en `http://127.0.0.1:4000` por defecto.

## Resumen de endpoints

- `GET /api/health`
- `GET /api/assignments`
- `POST /api/assignments`
- `GET /api/submissions?assignmentId=...`
- `POST /api/submissions`
- `GET /api/reviews?submissionId=...`
- `POST /api/reviews`
- `POST /api/assignments/:id/assign-one`
- `GET /api/export/grades?assignmentId=...`
