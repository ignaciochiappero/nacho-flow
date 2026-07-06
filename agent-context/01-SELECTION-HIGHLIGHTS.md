# Selection Highlights (Red #d32f2f)

## Problem
Items had no visual feedback when selected. Users couldn't tell what was selected.

## Approach
Each component type got a different highlight treatment, all using the same red color `#d32f2f`.

## Implementation by Component

### Nodes (`src/components/SceneLayers/Nodes/Node/Node.tsx`)
Uses CSS box properties — simplest case:
```tsx
border: isSelected ? '3px solid' : 'none',
borderColor: '#d32f2f',
boxShadow: isSelected
  ? '0 0 0 4px rgba(211,47,47,0.4), 0 0 0 8px rgba(211,47,47,0.15)'
  : 'none',
bgcolor: isSelected ? 'rgba(211,47,47,0.15)' : 'transparent'
```

### Rectangles (`src/components/SceneLayers/Rectangles/Rectangle/Rectangle.tsx`)
Two layers — border on the Box + overlay polygon:
```tsx
// Box border
border: isSelected ? '3px solid' : 'none',
borderColor: '#d32f2f'

// SVG overlay (inside the rectangle's IsoTileArea)
{isSelected && (
  <IsoTileArea
    tiles={rectangleTiles}
    color="#d32f2f"
    opacity={0.15}
    stroke="#d32f2f"
    strokeWidth={3}
  />
)}
```

### TextBoxes (`src/components/SceneLayers/TextBoxes/TextBox/TextBox.tsx`)
CSS with inset shadow:
```tsx
border: isSelected ? '3px solid' : 'none',
borderColor: '#d32f2f',
bgcolor: isSelected ? 'rgba(211,47,47,0.08)' : 'transparent',
boxShadow: isSelected ? 'inset 0 0 0 3px rgba(211,47,47,0.15)' : 'none'
```

### Connectors (`src/components/SceneLayers/Connectors/Connector.tsx`)
**Three-layer polyline approach** (no SVG filters — they get clipped by root `overflow: hidden`):

```tsx
{/* 1. Wide red background — "glow" substitute */}
{isSelected && (
  <polyline
    points={pathString}
    stroke="#d32f2f"
    strokeWidth={connectorWidthPx * 2.5}
    strokeOpacity={0.35}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeDasharray={strokeDashArray}
    fill="none"
  />
)}

{/* 2. White background — always present */}
<polyline
  stroke={theme.palette.common.white}
  strokeWidth={connectorWidthPx * 1.4}
  strokeOpacity={0.7}
  ...
/>

{/* 3. Foreground — red when selected, original color when not */}
<polyline
  stroke={isSelected ? '#d32f2f' : getColorVariant(color.value, 'dark', { grade: 1 })}
  strokeWidth={connectorWidthPx}
  ...
/>
```

### RubberBand (`src/components/RubberBand/RubberBand.tsx`)
Uses IsoTileArea with red:
```tsx
<IsoTileArea
  color="#d32f2f"
  opacity={0.15}
  stroke="#d32f2f"
  strokeWidth={3}
  tiles={rubberBandTiles}
/>
```

## How Selection State Flows

1. User clicks/drags → `Cursor.ts` sets `itemControls` (single) or `selectedItems` (multi)
2. `Renderer.tsx` reads `selectedItems` from `useUiStateStore`
3. `Renderer` passes `selectedItems` to each scene layer (Nodes, Rectangles, Connectors, TextBoxes)
4. Each layer checks if its item is in `selectedItems` or matches `itemControls`
5. Passes `isSelected` prop to individual component

## Gotcha: SVG Overflow Clipping

Root `Isoflow.tsx` has `overflow: hidden`. SVG filters (feGaussianBlur) that extend beyond the viewBox get clipped. Don't use SVG filter glow — use wider strokes instead.

## Gotcha: `selectedConnectorId` vs `selectedItems`

Connectors have TWO selection sources:
- `selectedConnectorId` from `itemControls` (single click)
- `selectedItems` array (rubber band / Ctrl+Click)

The `isSelected` prop combines both:
```ts
isSelected={selectedConnectorId === connector.id || isSelectedByMultiSelect}
```
