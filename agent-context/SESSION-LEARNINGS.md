# Isoflow Editor — Session Learnings

> All learnings from the feature implementation session. Any agent picking up this project should read this first.

---

## Architecture Overview

### Dual-Store Problem (CRITICAL)

The application splits state across **two Zustand stores**:

| Store | File | Contents |
|-------|------|----------|
| `ModelStore` | `src/stores/modelStore.tsx` | `Model` — items, views (connectors, rectangles, textBoxes inside views), icons, colors |
| `SceneStore` | `src/stores/sceneStore.tsx` | `Scene` — computed data: connector paths, textBox sizes (keyed by ID) |

**Reducers modify BOTH stores atomically** via `State = { model, scene }`. The caller writes both:
```ts
const setState = (newState: State) => {
  model.actions.set(newState.model);
  scene.actions.set(newState.scene);
};
```

**Implication for undo/redo**: You MUST snapshot/restore BOTH stores or operations will be incomplete. See `src/stores/undoRedoStore.ts`.

### Non-Hook Store Access

Both stores use React context + `createStore`, so they can't be accessed outside React. We added module-level refs:

```ts
// modelStore.tsx
let modelStoreRef: ReturnType<typeof initialState> | null = null;
export const getModelStore = () => { ... };

// sceneStore.tsx
let sceneStoreRef: ReturnType<typeof initialState> | null = null;
export const getSceneStore = () => { ... };
```

Used by undo/redo and any non-hook code that needs store access.

### Interaction System

- `src/interaction/useInteractionManager.ts` — Main hook, sets up event listeners, onKeyDown handler
- `src/interaction/modes/Cursor.ts` — Cursor mode actions (mousedown, mousemove, mouseup, dblclick)
- Mode actions receive fresh `mouse` via `baseState.mouse`, NOT `uiState.mouse` (stale state issue)
- `CursorMode` has `mousedownItem: ItemReference | null` for tracking drag targets

### Item Detection Priority

`getItemAtTile` in `src/utils/renderer.ts:450` checks in this order:
1. Items (nodes) — exact tile match
2. TextBoxes — bounding box check
3. Connectors — path tile match (converted to global coords)
4. Rectangles — bounding box check

First match wins. Nodes on top of connectors take priority.

### Selection System

Two selection mechanisms coexist:
- **Single**: `itemControls: ItemControls | null` — set by clicking an item
- **Multi**: `selectedItems: ItemReference[]` — rubber band or Ctrl+Click

Both are in `UiState` store (`src/stores/uiStateStore.tsx`).

---

## Features Implemented

### 1. Double-Click Creation Menu

**Files**: `Cursor.ts:147`, `ContextMenuManager.tsx`, `ContextMenu.tsx`

- `ContextMenu` extended with `type?: 'item' | 'create'`
- Double-click on empty space opens creation menu with Add Icon/Rectangle/TextBox
- Default icon for new items: `"block"` from `@isoflow/isopacks` (`src/config.ts:DEFAULT_ICON`)

### 2. Right-Click Drag Panning

**Files**: `Cursor.ts`, `useInteractionManager.ts`, `src/types/common.ts`

- `SlimMouseEvent` extended with `button` and `ctrlKey` fields
- `getMouse` stores `button` and `ctrlKey` on mousedown
- Right-click drag uses same delta-to-scroll logic as `Pan.ts`
- Context menu suppressed if right-click drag distance > 5px (tracked via `rightClickStartRef`)
- Right-click drag does NOT clear selection (button !== 0 check)

### 3. Delete Key Removal

**File**: `useInteractionManager.ts:197-271`

- Handles both multi-selection (`selectedItems`) and single selection (`itemControls`)
- Deletes VIEWITEM + MODELITEM (shared ID), RECTANGLE, CONNECTOR, or TEXTBOX
- Clears `itemControls` after delete (prevents crash from stale controls rendering)
- Try-catch around each delete — items may be implicitly deleted (e.g., connector deleted with rectangle)
- Calls `uiState.actions.setSelectedItems([])` after multi-delete

### 4. Multi-Selection (Rubber Band + Ctrl+Click)

**Files**: `Cursor.ts`, `src/utils/selection.ts`, `src/stores/uiStateStore.tsx`

- **Rubber band**: mousedown on empty space starts, mouseup calculates selection via `getItemsInArea`
- **Ctrl+Click**: toggles items in/out of multi-selection
- Ctrl+Click on empty space does NOT start rubber band or clear selection
- `getItemsInArea` checks nodes (tile match), rectangles (bounding box), textBoxes (bounding box), connectors (path tiles with `connectorPathTileToGlobal`)
- Connectors use `isWithinBounds` with bounding box of all path tiles

### 5. Multi-Item Drag

**File**: `Cursor.ts:215-238`

- If mousedown item is in `selectedItems`, drag ALL selected items together
- `DragItems` mode already supports `items: ItemReference[]`
- Clicking an already-selected item without Ctrl keeps selection (for drag)
- Clicking a non-selected item clears multi-selection

### 6. Selection Highlights (Red #d32f2f)

| Component | File | Effect |
|-----------|------|--------|
| Node | `Node.tsx` | Red border + glow (boxShadow) + tinted background |
| Rectangle | `Rectangle.tsx` | Red border + red overlay fill |
| TextBox | `TextBox.tsx` | Red border + background + inset shadow |
| Connector | `Connector.tsx` | Wider semi-transparent red polyline (2.5x, 0.35 opacity) + red foreground |
| RubberBand | `RubberBand.tsx` | Red fill + stroke via IsoTileArea |

### 7. Undo/Redo (Ctrl+Z / Ctrl+Y)

**Files**: `src/stores/undoRedoStore.ts`, `useInteractionManager.ts`

- Snapshot-based: captures `Model` (items, views, icons, colors) + `Scene` (connectors, textBoxes)
- Debounced snapshots (50ms) to avoid duplicates
- `isUndoing` flag prevents recursive snapshot capture during restore
- MAX_HISTORY = 100
- Subscribes to BOTH modelStore and sceneStore changes
- `performUndo`/`performRedo` call `setState` on both stores

---

## Critical Gotchas

### 1. Array Deletion: Use `splice()`, NOT `delete`

```ts
// WRONG — creates sparse array with undefined entries
delete draft.model.views[view.index].connectors[connector.index];

// CORRECT — removes element and shifts indices
draft.model.views[view.index].connectors?.splice(connector.index, 1);
```

JavaScript `delete` on array indices creates holes. Subsequent `.find()` may return undefined entries.

### 2. Stale Mouse State in Mode Actions

Mode actions receive `mouse` as a parameter (fresh). Do NOT read `uiState.mouse` inside mode actions — it's stale due to Zustand batching.

```ts
// WRONG (stale)
if (uiState.mouse.mousedown?.button === 2) return;

// CORRECT (fresh)
if (mouse.mousedown?.button === 2) return;
```

### 3. SVG Overflow Clipping

The root `Isoflow.tsx` Box has `overflow: hidden` (line 71). This clips ALL descendants. SVG `overflow: visible` cannot escape ancestor clips. Don't use SVG filters that extend beyond the viewBox — they'll be clipped.

**Solution**: Use wider strokes within the SVG bounds instead of filters.

### 4. Connector Path Coordinates

Connector paths use local coordinates relative to `rectangle.from`. To convert to global:
```ts
const globalTile = connectorPathTileToGlobal(pathTile, connector.path.rectangle.from);
```

### 5. Zustand `delete` vs `splice` on Model Arrays

Reducers use Immer `produce`. The `delete` operator on draft arrays creates sparse arrays. Always use `splice()` for removing elements from arrays in Immer drafts.

### 6. Connector Anchors

Dragging a connector creates/moves an anchor point (not the whole connector). `getAnchor` in `Cursor.ts` either finds an existing anchor or creates a new one.

### 7. Touch Events Need `button: 0`

Touch events are converted to mouse events for the interaction system. Always set `button: 0`:
```ts
onMouseEvent({ ...e, clientX, clientY, type: 'mousedown', button: 0 });
```

### 8. Connector Path Recomputation vs Translation (CRITICAL)

**NEVER use `translateConnectorPath` during drag.** It shifts all tiles by delta, breaking connections to non-dragged items.

**Always use `getConnectorPath({ anchors, view })`** to recompute paths from the updated model. The view items have already been updated in the immer draft, so `getAnchorTile` resolves correct positions.

```ts
// WRONG — both ends shift, disconnecting from non-dragged items
draft.scene.connectors[id] = { path: translateConnectorPath(path, delta) };

// CORRECT — recomputes from updated anchors + item positions
draft.scene.connectors[id] = {
  path: getConnectorPath({ anchors: connector.value.anchors, view: draftView.value })
};
```

### 9. `moveConnectorByDelta` Anchor Rules

- **`ref.item` anchors**: ALWAYS keep unchanged. `getAnchorTile` resolves the current position from the view.
- **`ref.tile` anchors**: Shift by delta (fixed position that needs to follow the drag).
- **`ref.anchor` anchors**: Keep unchanged (resolved recursively).

The old code converted non-dragged `ref.item` anchors to `ref.tile` with `old_tile + delta`. This permanently broke the item connection because `ref.tile` doesn't track item movement.

---

## File Reference

### Stores
- `src/stores/modelStore.tsx` — Model store + `getModelStore()`
- `src/stores/sceneStore.tsx` — Scene store + `getSceneStore()`
- `src/stores/uiStateStore.tsx` — UI state (selection, modes, context menu)
- `src/stores/undoRedoStore.ts` — Undo/redo history stack

### Types
- `src/types/ui.ts` — UiState, Mouse, ItemControls, SelectedItems
- `src/types/common.ts` — SlimMouseEvent (button, ctrlKey)
- `src/types/scene.ts` — Scene, SceneStore, SceneConnector
- `src/types/model.ts` — Model, View, Connector
- `src/types/interactions.ts` — State, ModeActions

### Interaction
- `src/interaction/useInteractionManager.ts` — Event listeners, Delete/Ctrl+Z/Ctrl+Y
- `src/interaction/modes/Cursor.ts` — All cursor mode logic
- `src/interaction/modes/DragItems.ts` — Multi-item drag

### Reducers
- `src/stores/reducers/dragSelection.ts` — `applyDragDelta`, `syncDragConnectors`, `resolveDragConnectors`
- `src/stores/reducers/connector.ts` — `syncConnector`, `updateConnector`, `deleteConnector`
- `src/stores/reducers/viewItem.ts` — `updateViewItem` (SYNC_CONNECTOR on tile change)

### Utils
- `src/utils/renderer.ts` — `getItemAtTile`, `getBoundingBox`, `isWithinBounds`, `getConnectorPath` (line 352), `translateConnectorPath` (line 431), `moveConnectorByDelta` (line 598), `getAnchorTile` (line 315), `getConnectorsByViewItem` (line 700)
- `src/utils/selection.ts` — `getItemsInArea` (rubber band)
- `src/utils/CoordsUtils.ts` — Coordinate math
- `src/utils/index.ts` — Re-exports

### Scene Layers
- `src/components/SceneLayers/Nodes/Node/Node.tsx` — isSelected: red border + glow
- `src/components/SceneLayers/Rectangles/Rectangle/Rectangle.tsx` — isSelected: red border + overlay
- `src/components/SceneLayers/Connectors/Connector/Connector.tsx` — isSelected: red wider stroke
- `src/components/SceneLayers/TextBoxes/TextBox/TextBox.tsx` — isSelected: red border + bg
- `src/components/RubberBand/RubberBand.tsx` — Selection area visual

### Hooks
- `src/hooks/useScene.ts` — Scene data + actions (delete, add operations)
- `src/hooks/useConnector.ts` — Connector data with computed path
- `src/hooks/useModelItem.ts` — Model item with `find()` (not `findIndex`)
- `src/hooks/useIsoProjection.ts` — Isometric positioning + sizing
