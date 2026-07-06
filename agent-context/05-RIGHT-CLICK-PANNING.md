# Right-Click Drag Panning

## Problem
Users expected to pan with right-click drag (common in CAD/3D tools). Only left-click drag was working.

## Approach
Reuse the same delta-to-scroll logic as `Pan.ts`, but triggered by right-click drag in Cursor mode.

## Files Changed

### `src/types/common.ts`
Added `button` and `ctrlKey` to `SlimMouseEvent`:
```ts
export interface SlimMouseEvent {
  clientX: number;
  clientY: number;
  type: string;
  button: number;   // NEW: 0=left, 2=right
  ctrlKey: boolean; // NEW
}
```

### `src/utils/renderer.ts` — `getMouse`
Now stores `button` and `ctrlKey` on mousedown:
```ts
getMouse: (e: SlimMouseEvent): Mouse => {
  if (e.type === 'mousedown') {
    return {
      mousedown: e,
      position: build(e.clientX - left - width / 2, e.clientY - top - height / 2).coords,
      button: e.button,
      ctrlKey: e.ctrlKey
    };
  }
  // ... rest unchanged
}
```

### `src/interaction/modes/Cursor.ts`

#### mousedown
Track right-click start position for context menu suppression:
```ts
if (e.button === 2) {
  rightClickStartRef.current = { x: e.clientX, y: e.clientY };
}
```

#### mousemove
If right mouse button held, pan the view:
```ts
if (mouse.mousedown && mouse.mousedown.button === 2) {
  // Suppress context menu if dragged > 5px
  if (rightClickStartRef.current) {
    const dx = e.clientX - rightClickStartRef.current.x;
    const dy = e.clientY - rightClickStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      rightClickDraggingRef.current = true;
    }
  }

  // Pan using same logic as Pan.ts
  const { scroll } = uiState;
  uiState.actions.setScroll({
    x: scroll.x + (mouse.mousedown.clientX - e.clientX) / uiState.zoom,
    y: scroll.y + (mouse.mousedown.clientY - e.clientY) / uiState.zoom
  });

  return;
}
```

#### mouseup
If right-click didn't drag, show context menu:
```ts
if (mouse.mousedown.button === 2) {
  if (!rightClickDraggingRef.current) {
    // Show context menu at mouse position
    uiState.actions.setContextMenu({
      position: mouse.position,
      visible: true
    });
  }
  rightClickDraggingRef.current = false;
  rightClickStartRef.current = null;
  return; // Don't process further
}
```

## Key Decisions

1. **5px threshold** — Small movement shouldn't suppress context menu
2. **Reused Pan.ts delta logic** — Consistent behavior across panning methods
3. **`rightClickDraggingRef`** — Prevents context menu from showing after drag
4. **Right-click drag doesn't clear selection** — Only button===0 clears selection

## Touch Events
Touch events are converted to mouse events. Always set `button: 0`:
```ts
onMouseEvent({
  ...e,
  clientX,
  clientY,
  type: 'mousedown',
  button: 0  // Touch is always left-click
});
```
