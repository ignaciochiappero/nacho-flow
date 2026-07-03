import { Coords, ItemReference } from 'src/types';
import type { useScene } from 'src/hooks/useScene';
import { isWithinBounds, getBoundingBox, connectorPathTileToGlobal } from './renderer';
import { CoordsUtils } from './CoordsUtils';

interface GetItemsInArea {
  from: Coords;
  to: Coords;
  scene: ReturnType<typeof useScene>;
}

const sortByPosition = (coords: Coords[]) => {
  const xs = coords.map((c) => c.x);
  const ys = coords.map((c) => c.y);
  return {
    lowX: Math.min(...xs),
    lowY: Math.min(...ys),
    highX: Math.max(...xs),
    highY: Math.max(...ys)
  };
};

export const getItemsInArea = ({
  from,
  to,
  scene
}: GetItemsInArea): ItemReference[] => {
  const selected: ItemReference[] = [];
  const bounds = getBoundingBox([from, to]);
  const { lowX, lowY, highX, highY } = sortByPosition([from, to]);

  // Check nodes (items)
  for (const item of scene.items) {
    if (isWithinBounds(item.tile, bounds)) {
      selected.push({ type: 'ITEM', id: item.id });
    }
  }

  // Check rectangles
  for (const rectangle of scene.rectangles) {
    const rectFrom = rectangle.from;
    const rectTo = rectangle.to;
    const rectLowX = Math.min(rectFrom.x, rectTo.x);
    const rectLowY = Math.min(rectFrom.y, rectTo.y);
    const rectHighX = Math.max(rectFrom.x, rectTo.x);
    const rectHighY = Math.max(rectFrom.y, rectTo.y);

    // Check if rectangles overlap
    if (
      rectLowX <= highX &&
      rectHighX >= lowX &&
      rectLowY <= highY &&
      rectHighY >= lowY
    ) {
      selected.push({ type: 'RECTANGLE', id: rectangle.id });
    }
  }

  // Check connectors
  for (const connector of scene.connectors) {
    const hasPathTileInArea = connector.path.tiles.some((pathTile) => {
      const globalTile = connectorPathTileToGlobal(
        pathTile,
        connector.path.rectangle.from
      );
      return isWithinBounds(globalTile, bounds);
    });

    if (hasPathTileInArea) {
      selected.push({ type: 'CONNECTOR', id: connector.id });
    }
  }

  // Check textBoxes
  for (const textBox of scene.textBoxes) {
    if (isWithinBounds(textBox.tile, bounds)) {
      selected.push({ type: 'TEXTBOX', id: textBox.id });
    }
  }

  return selected;
};
