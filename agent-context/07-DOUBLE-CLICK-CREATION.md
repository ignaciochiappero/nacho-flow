# Double-Click Creation Menu

## Problem
Users needed a quick way to create items. Previously, they had to use a separate UI panel.

## Approach
Double-click on empty space opens a context menu with creation options.

## Implementation

### `ContextMenu` Component (`src/components/ContextMenu/ContextMenu.tsx`)

Extended with `type` prop:
```tsx
interface ContextMenuItem {
  icon?: string;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  type?: 'item' | 'create';  // NEW
  reference?: ItemReference;  // Existing items
  onItemClicked?: (ref: ItemReference) => void;
}
```

### `Cursor.ts` — `dblclick` handler
```ts
dblclick: (e: SlimMouseEvent) => {
  const mouseDownItem = getItemAtTile(mouse.position, scene);
  if (!mouseDownItem) {
    uiState.actions.setContextMenu({
      visible: true,
      position: mouse.position,
      menuItems: [
        {
          type: 'create',
          label: 'Add Icon',
          icon: 'block',
          onClick: () => {
            model.actions.addItem(mouse.position, 'block');
          }
        },
        {
          type: 'create',
          label: 'Add Rectangle',
          icon: 'block',
          onClick: () => {
            const from = mouse.position;
            const to = CoordsUtils.build(from).add({ x: 1, y: 1 }).coords;
            model.actions.addRectangle(from, to, '#a9a9a9');
          }
        },
        {
          type: 'create',
          label: 'Add TextBox',
          icon: 'block',
          onClick: () => {
            model.actions.addTextBox(mouse.position, '');
          }
        }
      ]
    });
  }
}
```

### `ContextMenuManager.tsx` — Renders creation items

```tsx
{menuItems.map((item, i) => {
  if (item.type === 'create') {
    return (
      <MenuItem key={i} onClick={(e) => {
        item.onClick?.(e);
        uiState.getState().setContextMenu({ visible: false });
      }}>
        <ListItemIcon>
          <Icon name={item.icon || 'block'} />
        </ListItemIcon>
        <ListItemText primary={item.label} />
      </MenuItem>
    );
  }
  // ... existing item rendering
})}
```

## Default Icon
New items use `"block"` from `@isoflow/isopacks`:
```ts
// src/config.ts
export const DEFAULT_ICON = {
  url: '/block.svg',  // Block SVG
  name: 'block'
};
```

`useIcon.tsx` has graceful fallback to DEFAULT_ICON if icon not found.
