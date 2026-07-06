# Undo/Redo (Ctrl+Z / Ctrl+Y)

## Problem
Users needed to undo accidental deletions and other destructive operations.

## Approach
Snapshot-based undo/redo. Captures both `ModelStore` + `SceneStore` state atomically.

## Why Two Stores?
- `ModelStore` has `items`, `views`, `icons`, `colors` (persistent data)
- `SceneStore` has `connectors`, `textBoxes` (computed path data)
- Connectors have `path.tiles` (stored) but also `path.from`, `path.to`, `path.rectangle` (computed)
- If you only snapshot ModelStore, connector paths will be stale after undo

## Implementation: `src/stores/undoRedoStore.ts`

### State
```ts
interface UndoRedoStore {
  undoStack: UndoRedoSnapshot[];
  redoStack: UndoRedoSnapshot[];
  isUndoing: boolean;
}
```

### Snapshot
```ts
interface UndoRedoSnapshot {
  model: Model;  // items, views, icons, colors
  scene: Scene;  // connectors, textBoxes (computed data)
}
```

### Capturing Snapshots
```ts
// Subscribe to modelStore changes
modelStore.subscribe((state) => {
  if (isUndoing) return; // Don't capture during restore

  const currentState = getUndoRedoState();
  currentState.setUndoRedoState({
    undoStack: [...currentState.undoStack, {
      model: state.model,
      scene: getSceneStore().getState().scene
    }],
    redoStack: []  // Clear redo on new action
  });
});
```

### Undo
```ts
export const performUndo = () => {
  const { undoStack, redoStack } = getUndoRedoState();
  const currentSnapshot = undoStack[undoStack.length - 1];
  if (!currentSnapshot) return;

  // Get current state for redo
  const currentState = {
    model: getModelStore().getState().model,
    scene: getSceneStore().getState().scene
  };

  // Restore previous state
  isUndoing = true;
  getModelStore().getState().set(currentSnapshot.model);
  getSceneStore().getState().set(currentSnapshot.scene);
  isUndoing = false;

  // Update stacks
  getUndoRedoState().setUndoRedoState({
    undoStack: undoStack.slice(0, -1),
    redoStack: [...redoStack, currentState]
  });
};
```

### Redo
Same logic, opposite direction.

## Integration with React

### `useInteractionManager.ts`
```ts
useEffect(() => {
  const onKeyDown = (e) => {
    // Ctrl+Z: Undo
    if (e.ctrlKey && e.code === 'KeyZ') {
      performUndo();
    }
    // Ctrl+Y or Ctrl+Shift+Z: Redo
    if (e.ctrlKey && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
      performRedo();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, []);
```

## Gotchas

### 1. `isUndoing` Flag
Without this, the subscription would capture the restore as a new history entry:
```ts
// WRONG — creates infinite loop
modelStore.subscribe((state) => {
  undoStack.push(state); // Captures restored state!
});

// CORRECT — skip during restore
if (isUndoing) return;
```

### 2. Both Stores Must Be Captured
If you only snapshot ModelStore, connector paths won't restore correctly:
```ts
// WRONG
const snapshot = { model: modelStore.getState().model };

// CORRECT
const snapshot = {
  model: getModelStore().getState().model,
  scene: getSceneStore().getState().scene
};
```

### 3. MAX_HISTORY Limit
```ts
const MAX_HISTORY = 50;
undoStack: [...currentState.undoStack.slice(-MAX_HISTORY), newSnapshot];
```

### 4. Performance
- Snapshots are debounced (50ms) to avoid rapid-fire captures
- Each snapshot copies the entire state — don't set MAX_HISTORY too high
