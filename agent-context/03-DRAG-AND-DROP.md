# Drag and Drop (Multi-Item + Connector Anchors)

## Overview
Two drag types: item dragging (nodes/rectangles/textBoxes) and connector anchor dragging.

## Item Dragging

### Entry Point: `Cursor.ts` mousedown (line 200-238)
```ts
if (e.button === 0) {
  const mouseDownItem = getItemAtTile(mouse.position, scene);

  // Ctrl+Click: toggle selection, don't drag
  if (uiState.mouse.ctrlKey) {
    if (mouseDownItem) {
      // Toggle item in/out of selectedItems
      const isSelected = selectedItems.some(i => i.id === mouseDownItem.id);
      if (isSelected) {
        setSelectedItems(selectedItems.filter(i => i.id !== mouseDownItem.id));
      } else {
        setSelectedItems([...selectedItems, mouseDownItem]);
      }
    }
    return;
  }

  // Click on already-selected item: keep selection (for drag)
  // Click on non-selected item: clear selection, select this one
  const isSelectedItem = selectedItems.some(i => i.id === mouseDownItem?.id);
  if (!isSelectedItem && mouseDownItem) {
    setSelectedItems([{ type: mouseDownItem.type, id: mouseDownItem.id }]);
  }

  // Start drag with ALL selected items
  if (isSelectedItem && selectedItems.length > 0) {
    mode.actions.setModeState({
      mode: CursorMode.DRAG_ITEMS,
      mouseDownItem: mouseDownItem,
      items: selectedItems  // ← ALL selected items
    });
  } else if (mouseDownItem) {
    mode.actions.setModeState({
      mode: CursorMode.DRAG_ITEMS,
      mouseDownItem: mouseDownItem,
      items: [{ type: mouseDownItem.type, id: mouseDownItem.id }]
    });
  }
}
```

### DragItems Mode: `src/interaction/modes/DragItems.ts`
- Stores initial positions of all items on mousedown
- On mousemove: calculates delta from mousedown position
- Adds delta to each item's initial position
- Supports both `ITEM` (node) and `RECTANGLE` types
- Connectors are NOT dragged directly — they update when connected nodes move

### How Items Move
```ts
// DragItems.ts mousemove
const delta = CoordsUtils.build(mouse.position).subtract(mouse.mousedown.position).coords;

for (const ref of items) {
  if (ref.type === 'ITEM') {
    const item = getItemById(ref.id, state.model);
    const initial = initialPositions[ref.id];
    const tile = CoordsUtils.build(initial.tile).add(delta).coords;
    state.model.actions.updateItemTile(item.index, tile);
  } else if (ref.type === 'RECTANGLE') {
    const rect = getRectangleById(ref.id, state.model);
    const initial = initialPositions[ref.id];
    const from = CoordsUtils.build(initial.from).add(delta).coords;
    const to = CoordsUtils.build(initial.to).add(delta).coords;
    state.model.actions.updateRectangle(rect.index, { from, to });
  }
}
```

## Connector Anchor Dragging

### Entry Point: `Cursor.ts` mousedown
When clicking on a connector, it checks for an anchor point:
```ts
const anchor = getAnchor(mouse.position, connector, scene);
if (anchor) {
  mode.actions.setModeState({
    mode: CursorMode.CONNECTOR_ANCHOR,
    anchor: anchor,
    connector: connector
  });
}
```

### `getAnchor` Logic
```ts
function getAnchor(position, connector, scene): Anchor | null {
  for (const [i, pathTile] of connector.path.tiles.entries()) {
    const pathTileGlobal = connectorPathTileToGlobal(pathTile, connector.path.rectangle.from);

    // Existing anchor at this tile?
    const anchor = connector.path.anchors.find(
      (a) => a.tile.x === pathTileGlobal.x && a.tile.y === pathTileGlobal.y
    );

    if (isSameTile(position, pathTileGlobal)) {
      if (anchor) {
        return { index: i, anchor: anchor, type: AnchorType.EXISTING };
      } else {
        return { index: i, type: AnchorType.NEW };
      }
    }
  }
  return null;
}
```

### CONNECTOR_ANCHOR Mode
- mousemove: updates anchor tile position
- mouseup: if new anchor, calls `scene.actions.addConnectorAnchor(connector.id, anchor)`

## Files Changed
- `src/interaction/modes/Cursor.ts` — Entry points for both drag types
- `src/interaction/modes/DragItems.ts` — Multi-item drag logic
- `src/interaction/modes/ConnectorAnchor.ts` — Anchor drag logic
- `src/utils/anchor.ts` — `getAnchor` utility

---

## CRITICAL: Connector Path Updates During Drag

### How it works (fixed)

When items are dragged, `applyDragDelta` in `src/stores/reducers/dragSelection.ts`:

1. **Updates item tiles** in the model draft (immer): `viewItem.value.tile = add(tile, delta)`
2. **Updates connector anchors** via `moveConnectorByDelta` — ALL `ref.item` anchors are kept unchanged; only `ref.tile` anchors shift by delta
3. **Recomputes scene connector paths** using `getConnectorPath({ anchors, view: draftView.value })` — reads updated item tiles from the draft

### What NOT to do (the bug)

The original code used `translateConnectorPath(sceneConnector.path, delta)` which simply shifted ALL tiles in the path by delta. This caused:
- Both ends of the connector to move, even though one end is attached to a non-dragged item
- Visual disconnect during drag (connector appears to "pull away" from the non-dragged item)
- Correct path only restored on mouseup when `syncDragConnectors` recomputed from scratch

### Key functions

- `getConnectorPath` (renderer.ts:352) — computes full path from anchors + view positions. Use during drag.
- `translateConnectorPath` (renderer.ts:431) — shifts existing path by delta. NOT suitable for drag (loses anchor-item relationships).
- `moveConnectorByDelta` (renderer.ts:598) — updates connector anchors for drag. Keeps `ref.item` anchors unchanged.
- `syncConnector` (connector.ts:22) — recomputes path on mouseup via `getConnectorPath`.

### The flow

```
mousemove → applyDragDelta(items, delta)
  → produce(state, draft):
    1. Update item tiles in draft.model.views
    2. moveConnectorByDelta for connectorIdsToMove (keeps ref.item anchors)
    3. getConnectorPath for each moved connector (reads updated items from draft)
  → syncConnector for syncOnlyIds (non-moved connectors)
```
