import { produce } from 'immer';
import { ModeActions, Coords, ItemReference } from 'src/types';
import { useScene } from 'src/hooks/useScene';
import {
  getItemByIdOrThrow,
  CoordsUtils,
  hasMovedTile,
  getAnchorParent,
  getItemAtTile
} from 'src/utils';
import { getSelectedConnectorIdsFromItems } from 'src/stores/reducers/dragSelection';

const isBatchTranslateDrag = (items: ItemReference[]) => {
  return items.some((item) => {
    return (
      item.type === 'ITEM' ||
      item.type === 'RECTANGLE' ||
      item.type === 'TEXTBOX' ||
      item.type === 'CONNECTOR'
    );
  });
};

const dragConnectorAnchor = (
  item: ItemReference,
  tile: Coords,
  scene: ReturnType<typeof useScene>
) => {
  const connector = getAnchorParent(item.id, scene.connectors);

  const newConnector = produce(connector, (draft) => {
    const anchor = getItemByIdOrThrow(connector.anchors, item.id);
    const itemAtTile = getItemAtTile({ tile, scene });

    switch (itemAtTile?.type) {
      case 'ITEM':
        draft.anchors[anchor.index] = {
          ...anchor.value,
          ref: {
            item: itemAtTile.id
          }
        };
        break;
      case 'CONNECTOR_ANCHOR':
        draft.anchors[anchor.index] = {
          ...anchor.value,
          ref: {
            anchor: itemAtTile.id
          }
        };
        break;
      default:
        draft.anchors[anchor.index] = {
          ...anchor.value,
          ref: {
            tile
          }
        };
        break;
    }
  });

  scene.updateConnector(connector.id, newConnector);
};

const dragItems = (
  items: ItemReference[],
  tile: Coords,
  delta: Coords,
  scene: ReturnType<typeof useScene>
) => {
  const selectedConnectorIds = getSelectedConnectorIdsFromItems(items);

  if (isBatchTranslateDrag(items)) {
    scene.applyDragDelta(items, delta);
    return;
  }

  items.forEach((item) => {
    if (item.type !== 'CONNECTOR_ANCHOR') {
      return;
    }

    const parent = getAnchorParent(item.id, scene.connectors);

    if (selectedConnectorIds.has(parent.id)) {
      return;
    }

    dragConnectorAnchor(item, tile, scene);
  });
};

export const DragItems: ModeActions = {
  entry: ({ uiState, rendererRef }) => {
    if (uiState.mode.type !== 'DRAG_ITEMS' || !uiState.mouse.mousedown) return;

    const renderer = rendererRef;
    renderer.style.userSelect = 'none';
  },
  exit: ({ rendererRef }) => {
    const renderer = rendererRef;
    renderer.style.userSelect = 'auto';
  },
  mousemove: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'DRAG_ITEMS' || !uiState.mouse.mousedown) return;

    if (uiState.mode.isInitialMovement) {
      const delta = CoordsUtils.subtract(
        uiState.mouse.position.tile,
        uiState.mouse.mousedown.tile
      );

      dragItems(uiState.mode.items, uiState.mouse.position.tile, delta, scene);

      uiState.actions.setMode(
        produce(uiState.mode, (draft) => {
          draft.isInitialMovement = false;
        })
      );

      return;
    }

    if (!hasMovedTile(uiState.mouse) || !uiState.mouse.delta?.tile) return;

    const delta = uiState.mouse.delta.tile;

    dragItems(uiState.mode.items, uiState.mouse.position.tile, delta, scene);
  },
  mouseup: ({ uiState, scene }) => {
    if (uiState.mode.type === 'DRAG_ITEMS' && isBatchTranslateDrag(uiState.mode.items)) {
      scene.syncDragConnectors(uiState.mode.items);
    }

    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  }
};
