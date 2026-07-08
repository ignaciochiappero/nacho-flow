# Plan: SQLite Persistence for Isoflow

## Contexto

Isolow es una librería React puramente client-side. No hay backend, no hay persistencia. Los diagramas se pierden al recargar la página. El usuario quiere:

1. **Auto-save** de diagramas al modificarlos
2. **Exportar diagrama individual** como JSON (ya existe)
3. **Exportar todos los proyectos** como archivo `.sqlite`
4. **Exportar proyectos seleccionados** en batch como `.sqlite`

## Arquitectura: Backend Node + better-sqlite3

### Por qué backend y no sql.js (WASM)

| Criterio | Backend (better-sqlite3) | sql.js (WASM) |
|----------|--------------------------|----------------|
| Performance | Nativo, muy rápido | Más lento (WASM overhead) |
| Archivo en disco | Escritura directa a `.sqlite` | Export manual a blob |
| Setup | `npm run dev` (ya existe Node) | Self-contained, sin server |
| Futuro | API extensible, auth, sync | Limitado al browser |
| Tamaño | ~0 (usa SQLite del OS) | ~2MB WASM bundle |

**Decisión**: Backend Node. Es más robusto, performante, y el usuario ya tiene Node.

---

## 1. Estructura de archivos a crear

```
server/
├── index.ts              # Entry point, Express server
├── database.ts           # SQLite setup + schema
├── routes/
│   └── projects.ts       # CRUD API routes
└── package.json          # Server dependencies (separado del frontend)

src/
├── hooks/
│   └── useAutoSave.ts    # Hook para auto-save debounced
├── services/
│   └── api.ts            # Cliente HTTP para backend
├── components/
│   └── ProjectManager/
│       ├── ProjectManager.tsx    # UI de gestión de proyectos
│       ├── ProjectList.tsx       # Lista de proyectos guardados
│       ├── ExportDialog.tsx      # Dialog de exportación (JSON/SQLite)
│       └── index.ts
```

## 2. Database Schema

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  model TEXT NOT NULL,           -- JSON serializado del Model
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_updated ON projects(updated_at);
```

**Por qué un solo campo `model` JSON:**
- El Model ya tiene un schema Zod válido
- No necesitamos query por campos internos del model
- Simplifica el schema y las operaciones
- La validación se hace en el frontend antes de guardar

## 3. API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/projects` | Listar todos los proyectos |
| `GET` | `/api/projects/:id` | Obtener un proyecto |
| `POST` | `/api/projects` | Crear proyecto |
| `PUT` | `/api/projects/:id` | Actualizar proyecto |
| `DELETE` | `/api/projects/:id` | Eliminar proyecto |
| `POST` | `/api/projects/export/sqlite` | Exportar选択された projetos como `.sqlite` |
| `GET` | `/api/projects/:id/export/json` | Exportar un proyecto como `.json` |

## 4. Auto-Save Integration

### Flujo de datos

```
Model cambia (Zustand)
  → onModelUpdated callback (ya existe en Isoflow.tsx)
    → useAutoSave hook (debounce 1s)
      → PUT /api/projects/:id
        → Server actualiza SQLite
```

### Hook: `useAutoSave`

```ts
// src/hooks/useAutoSave.ts
export const useAutoSave = (model: Model, projectId: string | null) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!projectId) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      await api.updateProject(projectId, model);
    }, 1000); // 1 segundo de debounce

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [model, projectId]);
};
```

### Integración en Isoflow.tsx

```tsx
// Dentro del componente Isoflow
useAutoSave(model, currentProjectId);
```

## 5. Exportación SQLite

### Backend: Generar archivo `.sqlite`

El endpoint `POST /api/projects/export/sqlite`:
1. Crea un SQLite temporal en memoria
2. Crea la tabla `projects`
3. Copia los proyectos seleccionados del DB principal
4. Stream del archivo como descarga

```ts
// server/routes/projects.ts
router.post('/export/sqlite', (req, res) => {
  const { projectIds } = req.body;

  // Crear DB temporal
  const exportDb = new Database(':memory:');
  exportDb.exec(`CREATE TABLE projects (...)`);

  // Copiar proyectos seleccionados
  const projects = projectIds
    ? db.prepare('SELECT * FROM projects WHERE id IN (?)').all(projectIds)
    : db.prepare('SELECT * FROM projects').all();

  const insert = exportDb.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of projects) {
    insert.run(p.id, p.title, p.description, p.model, p.created_at, p.updated_at);
  }

  // Enviar como archivo
  const buffer = exportDb.serialize();
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename=isoflow-projects.sqlite');
  res.send(buffer);
});
```

## 6. UI: ProjectManager

### Componente principal

```tsx
// src/components/ProjectManager/ProjectManager.tsx
- Lista de proyectos guardados (título, fecha,acciones)
- Botón "Nuevo proyecto"
- Botón "Exportar como SQLite" (abre dialog de selección)
- Botón "Importar SQLite" (file picker)
- Auto-save indicator (icono mostrando estado)
```

### Dialog de exportación

```tsx
// src/components/ProjectManager/ExportDialog.tsx
- Checkbox list de proyectos
- Botón "Exportar todos"
- Botón "Exportar seleccionados"
- Genera descarga `.sqlite`
```

## 7. Configuración del Server

### `server/package.json`

```json
{
  "name": "isoflow-server",
  "scripts": {
    "dev": "nodemon --watch . --ext ts --exec ts-node index.ts",
    "start": "ts-node index.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/better-sqlite3": "^7.6.8",
    "@types/cors": "^2.8.17",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2",
    "typescript": "^5.3.3"
  }
}
```

### `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Webpack proxy (para desarrollo)

```js
// webpack/dev.config.js — agregar proxy
devServer: {
  ...existing,
  proxy: [{
    context: ['/api'],
    target: 'http://localhost:3001',
  }]
}
```

## 8. Script de inicio

```json
// package.json (frontend) — agregar script
"scripts": {
  "start:full": "concurrently \"npm run server:dev\" \"npm run start\"",
  "server:dev": "cd server && npm run dev",
  "server:start": "cd server && npm run start"
}
```

## 9. Pasos de implementación

1. **Crear `server/`** — package.json, tsconfig.json, database.ts, index.ts
2. **Crear schema SQLite** — tabla projects con índices
3. **Crear rutas API** — CRUD + export
4. **Configurar webpack proxy** — redirigir `/api` al server
5. **Crear `src/services/api.ts`** — cliente HTTP
6. **Crear `src/hooks/useAutoSave.ts`** — debounce + PUT
7. **Integrar auto-save en Isoflow.tsx** — usar `onModelUpdated`
8. **Crear ProjectManager UI** — lista, CRUD, exportación
9. **Crear ExportDialog** — selección de proyectos + descarga SQLite
10. **Agregar scripts** — concurrently para dev
11. **Testear** — auto-save, export JSON, export SQLite, import SQLite
