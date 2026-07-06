# Multi-Selection (Rubber Band + Ctrl+Click)

## Problem
Users could only select one item at a time. Needed to select multiple items for batch delete, drag, etc.

## Two Selection Mechanisms

### Rubber Band (drag on empty space)
- **Start**: mousedown on empty tile (no item at tile)
- **Update**: mousemove updates `rubberBand.to`
- **End**: mouseup calculates selected items via `getItemsInArea`, clears rubber band

### Ctrl+Click (toggle individual items)
- **On item**: toggles item in/out of `selectedItems` array
- **On empty space**: does nothing (no rubber band, no selection clear)
- **Without Ctrl on empty space**: clears selection, starts rubber band

## Data Flow

```
User action
  → Cursor.ts mousedown/mousemove/mouseup
    → uiState.actions.setSelectedItems([...])
    → uiState.actions.setRubberBand({ from, to })
  → Renderer.tsx reads selectedItems
    → Passes to each scene layer
      → Each layer computes isSelected per item
```

## Files Changed

### `src/types/ui.ts`
Added to UiState:
```ts
selectedItems: ItemReference[];
rubberBand: RubberBand | null;
setSelectedItems: (items: ItemReference[]) => void;
setRubberBand: (rb: RubberBand | null) => void;
```

Added `ctrlKey` to `Mouse`:
```ts
export interface Mouse {
  position: Coords;
  mousedown: SlimMouseEvent | null;
  ctrlKey: boolean;
}
```

### `src/types/common.ts`
Added `button` and `ctrlKey` to `SlimMouseEvent`:
```ts
export interface SlimMouseEvent {
  clientX: number;
  clientY: number;
  type: string;
  button: number;   // NEW: 0=left, 2=right
  ctrlKey: boolean; // NEW: for multi-select
}
```

### `src/utils/selection.ts` (NEW)
`getItemsInArea` — checks all item types against a bounding box:
```ts
export const getItemsInArea = ({ from, to, scene }): ItemReference[] => {
  const bounds = getBoundingBox([from, to]);
  const selected: ItemReference[] = [];

  // Nodes: exact tile match within bounds
  for (const item of scene.items) {
    if (isWithinBounds(item.tile, bounds)) {
      selected.push({ type: 'ITEM', id: item.id });
    }
  }

  // Rectangles: bounding box overlap
  for (const rect of scene.rectangles) {
    const rectBounds = getBoundingBox([rect.from, rect.to]);
    if (boundsOverlap(bounds, rectBounds)) {
      selected.push({ type: 'RECTANGLE', id: rect.id });
    }
  }

  // TextBoxes: bounding box overlap
  // (similar to rectangles)

  // Connectors: any path tile within bounds
  for (const connector of scene.connectors) {
    const hasPathTileInArea = connector.path.tiles.some((pathTile) => {
      const globalTile = connectorPathTileToGlobal(pathTile, connector.path.rectangle.from);
      return isWithinBounds(globalTile, bounds);
    });
    if (hasPathTileInArea) {
      selected.push({ type: 'CONNECTOR', id: connector.id });
    }
  }

  return selected;
};
```

### `src/stores/uiStateStore.tsx`
Initial state:
```ts
selectedItems: [],
rubberBand: null,
ctrlKey: false
```

### `src/interaction/modes/Cursor.ts`

**mousedown** (line 80-145):
- Ctrl+Click on item → toggle in selectedItems
- Ctrl+Click on empty → do nothing
- Normal click on item → clear selection, set itemControls
- Normal click on empty → clear selection, start rubber band

**mousemove** (line 160-250):
- If rubber band active → update rubberBand.to
- If dragging connector → convert to CONNECTOR_ANCHOR
- If dragging selected item → drag ALL selected items

**mouseup** (line 252-301):
- If rubber band → calculate selection via getItemsInArea
- If Ctrl → don't set itemControls
- If clicked item → set itemControls
- Only clear selection on button===0 (left click)

## Key Decisions

1. **Rubber band only on left-click empty space** — right-click drag is for panning
2. **Ctrl+Click on empty doesn't clear selection** — users expect Ctrl to be additive
3. **Clicking selected item keeps selection** — enables drag without losing multi-select
4. **`getItemsInArea` sorts coordinates** via `sortByPosition` before creating bounding box
