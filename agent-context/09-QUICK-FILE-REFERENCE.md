# Quick File Reference

## Stores

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/stores/modelStore.tsx` | Model state (items, views, icons) | `useModelStore`, `getModelStore()` |
| `src/stores/sceneStore.tsx` | Scene state (connectors, textBoxes) | `useSceneStore`, `getSceneStore()` |
| `src/stores/uiStateStore.tsx` | UI state (selection, modes) | `useUiStateStore` |
| `src/stores/undoRedoStore.ts` | Undo/redo history | `performUndo`, `performRedo`, `initUndoRedo` |

## Types

| File | Key Types |
|------|-----------|
| `src/types/ui.ts` | `UiState`, `Mouse`, `ItemControls`, `SelectedItems` |
| `src/types/common.ts` | `SlimMouseEvent` (button, ctrlKey) |
| `src/types/scene.ts` | `Scene`, `SceneStore`, `SceneConnector` |
| `src/types/model.ts` | `Model`, `View`, `Connector` |
| `src/types/interactions.ts` | `State`, `ModeActions` |

## Interaction

| File | Purpose |
|------|---------|
| `src/interaction/useInteractionManager.ts` | Event listeners, Delete/Ctrl+Z/Ctrl+Y |
| `src/interaction/modes/Cursor.ts` | Default mode (click, drag, right-click pan, dblclick) |
| `src/interaction/modes/DragItems.ts` | Multi-item drag |
| `src/interaction/modes/ConnectorAnchor.ts` | Connector anchor drag |
| `src/interaction/modes/Pan.ts` | Scroll-based panning |

## Utils

| File | Key Functions |
|------|---------------|
| `src/utils/renderer.ts` | `getItemAtTile`, `getBoundingBox`, `isWithinBounds`, `getMouse` |
| `src/utils/selection.ts` | `getItemsInArea` (rubber band) |
| `src/utils/CoordsUtils.ts` | `build()`, `add()`, `subtract()`, `coords` |
| `src/utils/anchor.ts` | `getAnchor` (connector anchor detection) |
| `src/utils/common.ts` | `getItemByIdOrThrow` |

## Scene Components

| File | Selection Behavior |
|------|-------------------|
| `src/components/SceneLayers/Nodes/Node/Node.tsx` | Red border + glow + tinted bg |
| `src/components/SceneLayers/Rectangles/Rectangle/Rectangle.tsx` | Red border + overlay |
| `src/components/SceneLayers/Connectors/Connector/Connector.tsx` | Red wider stroke (3 layers) |
| `src/components/SceneLayers/TextBoxes/TextBox/TextBox.tsx` | Red border + inset shadow |
| `src/components/RubberBand/RubberBand.tsx` | Red fill + stroke |

## Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useScene.ts` | Scene data + actions |
| `src/hooks/useConnector.ts` | Connector with computed path |
| `src/hooks/useModelItem.ts` | Model item (find, not findIndex) |
| `src/hooks/useIsoProjection.ts` | Isometric positioning |
| `src/hooks/useIcon.tsx` | Icon resolution with fallback |
| `src/hooks/useAutoSave.ts` | Debounced auto-save (1s) |

## Services

| File | Purpose |
|------|---------|
| `src/services/api.ts` | HTTP client for backend API |

## Components (UI)

| File | Purpose |
|------|---------|
| `src/components/ProjectManager/ProjectManager.tsx` | Project management dialog |

## Server

| File | Purpose |
|------|---------|
| `server/index.ts` | Express server entry point (port 3001) |
| `server/database.ts` | SQLite setup using sql.js (WASM) |
| `server/routes/projects.ts` | CRUD + export/import routes |
| `server/types/sql.js.d.ts` | Type declarations for sql.js |

## Config

| File | Key Values |
|------|------------|
| `src/config.ts` | `DEFAULT_ICON` (block), `DEFAULT_RECTANGLE_COLOR` |

## Common Patterns

### Delete from Array (Immer)
```ts
// CORRECT
draft.items.splice(index, 1);
// WRONG
delete draft.items[index];
```

### Access Store Outside React
```ts
import { getModelStore } from './modelStore';
const model = getModelStore().getState().model;
```

### Fresh Mouse in Mode Actions
```ts
// mouse is the parameter, NOT uiState.mouse
mousedown: (e, mouse, baseState) => {
  if (mouse.mousedown?.button === 2) { ... }
}
```

### Touch Events → Mouse Events
```ts
onMouseEvent({
  ...e,
  clientX,
  clientY,
  type: 'mousedown',
  button: 0  // Always left-click for touch
});
```
