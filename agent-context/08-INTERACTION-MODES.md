# Interaction Modes System

## Overview
The interaction system uses a state machine pattern. Each mode defines what happens on mousedown, mousemove, mouseup, and dblclick.

## Architecture

```
useInteractionManager.ts
  → Sets up event listeners (mousedown, mousemove, mouseup, dblclick)
  → Converts raw events to SlimMouseEvent
  → Routes to current mode's action handler
```

## Mode Types

### `CursorMode` (default)
- Click on item → select it
- Click on empty → deselect, start rubber band
- Drag item → switch to DRAG_ITEMS
- Drag connector anchor → switch to CONNECTOR_ANCHOR
- Right-click drag → pan view
- Double-click empty → creation menu

### `DragItems` Mode
- Stores initial positions of all items on entry
- On mousemove: calculates delta, updates all items
- On mouseup: exits mode

### `Pan` Mode
- Tracks scroll offset based on mouse delta
- On mouseup: exits mode

### `ConnectorAnchor` Mode
- Updates anchor position on mousemove
- On mouseup: commits anchor, exits mode

## Key Files

| File | Purpose |
|------|---------|
| `src/interaction/useInteractionManager.ts` | Main hook, event listeners |
| `src/interaction/modes/Cursor.ts` | Default mode actions |
| `src/interaction/modes/DragItems.ts` | Multi-item drag |
| `src/interaction/modes/ConnectorAnchor.ts` | Connector anchor drag |
| `src/interaction/modes/Pan.ts` | Scroll-based panning |
| `src/types/interactions.ts` | Mode types, State interface |

## State Flow

```
Raw Event (mousedown)
  → useInteractionManager converts to SlimMouseEvent
  → Calls mode.actions.mousedown(mouse, baseState)
    → Mode reads fresh mouse from baseState.mouse (NOT uiState.mouse)
    → Mode may switch modes (e.g., Cursor → DragItems)
    → Mode updates uiState (selection, context menu, etc.)
```

## Critical: Fresh Mouse State

Mode actions receive `mouse` as a parameter. Do NOT read `uiState.mouse`:
```ts
// WRONG — stale
if (uiState.mouse.mousedown?.button === 2) return;

// CORRECT — fresh
if (mouse.mousedown?.button === 2) return;
```

`uiState.mouse` is stale due to Zustand batching. The `mouse` parameter is the freshly computed value.
