# Delete Key Item Removal

## Problem
Users needed to delete items from the canvas. No keyboard shortcut existed.

## Approach
Listen for Delete/Backspace key on window, delete all selected items.

## Implementation: `useInteractionManager.ts` (line 197-271)

```ts
const onKeyDown = (e: KeyboardEvent) => {
  // Delete/Backspace
  if (e.code === 'Delete' || e.code === 'Backspace') {
    const { itemControls, selectedItems } = uiState.getState();

    // Multi-selection delete
    if (selectedItems.length > 0) {
      for (const ref of selectedItems) {
        try {
          if (ref.type === 'ITEM') {
            scene.actions.deleteItem(ref.id);
            model.actions.deleteItem(ref.id);
          } else if (ref.type === 'RECTANGLE') {
            model.actions.deleteRectangle(ref.id);
          } else if (ref.type === 'CONNECTOR') {
            scene.actions.deleteConnector(ref.id);
          } else if (ref.type === 'TEXTBOX') {
            scene.actions.deleteTextBox(ref.id);
          }
        } catch (err) {
          // Item may be implicitly deleted (e.g., connector with rectangle)
        }
      }
      uiState.getState().setItemSelected(null);
      uiState.getState().setSelectedItems([]);
      return;
    }

    // Single selection delete
    if (itemControls?.type === 'ITEM') {
      scene.actions.deleteItem(itemControls.id);
      model.actions.deleteItem(itemControls.id);
      uiState.getState().setItemSelected(null);
    } else if (itemControls?.type === 'RECTANGLE') {
      model.actions.deleteRectangle(itemControls.id);
      uiState.getState().setItemSelected(null);
    } else if (itemControls?.type === 'CONNECTOR') {
      scene.actions.deleteConnector(itemControls.id);
      uiState.getState().setItemSelected(null);
    } else if (itemControls?.type === 'TEXTBOX') {
      scene.actions.deleteTextBox(itemControls.id);
      uiState.getState().setItemSelected(null);
    }
  }
};
```

## View Item + Model Item Deletion

Items exist in both `Model` (items array) and `View` (items array). When deleting:
1. Delete from Model: `model.actions.deleteItem(id)` — sets item to `null` in model.items
2. Delete from View: `scene.actions.deleteItem(id)` — removes from view.items array

Both must be called, or you'll have orphaned references.

## Gotchas

### 1. Try-Catch for Implicit Deletion
Deleting a rectangle may auto-delete connected connectors. Calling `deleteConnector` again throws:
```ts
// WRONG — throws if connector already deleted
scene.actions.deleteConnector(connectorId);

// CORRECT — catch and ignore
try {
  scene.actions.deleteConnector(connectorId);
} catch (err) {
  // Already deleted
}
```

### 2. Clear `itemControls` After Delete
If you don't clear `itemControls`, the deleted item's controls will try to render:
```ts
uiState.getState().setItemSelected(null);
// Without this → crash: "Cannot read property of null"
```

### 3. Array Splice, Not Delete
Reducers use Immer. `delete array[index]` creates sparse arrays:
```ts
// WRONG
delete draft.model.items[item.index];

// CORRECT
draft.model.items.splice(item.index, 1);
```

### 4. `getItemByIdOrThrow` in Connectors
`deleteConnector` calls `getItemByIdOrThrow`. If the connector doesn't exist, it throws.
