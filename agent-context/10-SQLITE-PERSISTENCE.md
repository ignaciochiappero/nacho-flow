# SQLite Persistence

## Overview

The isoflow editor now supports SQLite-based persistence with auto-save functionality. This allows users to save their diagrams to a local database and manage multiple projects.

## Architecture

### Frontend
- `src/services/api.ts` — HTTP client for all API endpoints
- `src/hooks/useAutoSave.ts` — Debounced auto-save hook (1s)
- `src/components/ProjectManager/ProjectManager.tsx` — UI for project management
- `src/components/UiOverlay/UiOverlay.tsx` — Integrates ProjectManager

### Backend
- `server/index.ts` — Express server entry point (port 3001)
- `server/database.ts` — SQLite setup using sql.js (WASM)
- `server/routes/projects.ts` — CRUD + export/import routes

## Key Files

- `server/package.json` — Server dependencies (sql.js, express, cors)
- `server/tsconfig.json` — Server TypeScript config
- `server/types/sql.js.d.ts` — Type declarations for sql.js
- `webpack/dev.config.js` — Proxy `/api` → `localhost:3001`
- `package.json` — Added `start:full` script using concurrently

## How It Works

### Database
- Uses sql.js (WASM) — no native compilation required
- Data stored in `server/isoflow.db`
- Schema: `projects(id, title, description, model, created_at, updated_at)`
- Model stored as JSON string in `model` column
- Auto-saves to disk after each write operation

### Auto-Save
- `useAutoSave` hook takes `(model, projectId, enabled)`
- Debounces saves by 1 second
- Deduplicates via JSON.stringify comparison
- Uses `api.updateProject()` which calls PUT `/api/projects/:id`

### Project Manager
- Access via Main Menu → "Projects"
- Create new projects with current model state
- Select projects to export as SQLite file
- Export single project as JSON
- Delete projects

### Running
```bash
# Frontend + Backend together
npm run start:full

# Or separately
npm run start        # Frontend on :3000
npm run start:server # Backend on :3001
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get single project |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/export/sqlite` | Export as SQLite file |
| GET | `/api/projects/:id/export/json` | Export as JSON |
| POST | `/api/projects/import/sqlite` | Import projects |

## Gotchas

- sql.js runs in-memory; data is persisted to disk on each write
- The server must be running for project features to work
- Auto-save only works when `projectId` is set and `autoSave` is true
- The database file is created automatically on first run
- For production, consider using better-sqlite3 with proper native compilation
