import { produce } from 'immer';
import {
  ConnectorAnchor,
  SceneConnector,
  ModeActions,
  ModeActionsAction,
  Coords,
  View,
  RubberBand
} from 'src/types';
import {
  getItemAtTile,
  hasMovedTile,
  getAnchorAtTile,
  getItemByIdOrThrow,
  generateId,
  CoordsUtils,
  getAnchorTile,
  connectorPathTileToGlobal,
  getItemsInArea
} from 'src/utils';
import { useScene } from 'src/hooks/useScene';
import { DEFAULT_COLOR } from 'src/config';

const getAnchorOrdering = (
  anchor: ConnectorAnchor,
  connector: SceneConnector,
  view: View
) => {
  const anchorTile = getAnchorTile(anchor, view);
  const index = connector.path.tiles.findIndex((pathTile) => {
    const globalTile = connectorPathTileToGlobal(
      pathTile,
      connector.path.rectangle.from
    );
    return CoordsUtils.isEqual(globalTile, anchorTile);
  });

  if (index === -1) {
    throw new Error(
      `Could not calculate ordering index of anchor [anchorId: ${anchor.id}]`
    );
  }

  return index;
};

const getAnchor = (
  connectorId: string,
  tile: Coords,
  scene: ReturnType<typeof useScene>
) => {
  const connector = getItemByIdOrThrow(scene.connectors, connectorId).value;
  const anchor = getAnchorAtTile(tile, connector.anchors);

  if (!anchor) {
    const newAnchor: ConnectorAnchor = {
      id: generateId(),
      ref: { tile }
    };

    const orderedAnchors = [...connector.anchors, newAnchor]
      .map((anch) => {
        return {
          ...anch,
          ordering: getAnchorOrdering(anch, connector, scene.currentView)
        };
      })
      .sort((a, b) => {
        return a.ordering - b.ordering;
      });

    scene.updateConnector(connector.id, { anchors: orderedAnchors });
    return newAnchor;
  }

  return anchor;
};

const mousedown: ModeActionsAction = ({
  uiState,
  scene,
  mouse,
  isRendererInteraction
}) => {
  if (uiState.mode.type !== 'CURSOR' || !isRendererInteraction) return;

  // Right-click: don't select items, just allow panning
  if (mouse.mousedown?.button === 2) return;

  const itemAtTile = getItemAtTile({
    tile: mouse.position.tile,
    scene
  });

  if (itemAtTile) {
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = itemAtTile;
      })
    );

    if (mouse.ctrlKey) {
      // Ctrl+Click: toggle item in multi-selection
      const isSelected = uiState.selectedItems.some(
        (item) => item.type === itemAtTile.type && item.id === itemAtTile.id
      );
      if (isSelected) {
        uiState.actions.setSelectedItems(
          uiState.selectedItems.filter(
            (item) => !(item.type === itemAtTile.type && item.id === itemAtTile.id)
          )
        );
      } else {
        uiState.actions.setSelectedItems([...uiState.selectedItems, itemAtTile]);
      }
      uiState.actions.setItemControls(null);
    } else {
      uiState.actions.setItemControls(itemAtTile);
      uiState.actions.setSelectedItems([]);
    }
  } else {
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
      })
    );

    uiState.actions.setItemControls(null);

    // Start rubber band selection (not on Ctrl+Click)
    if (!mouse.ctrlKey) {
      uiState.actions.setRubberBand({
        from: uiState.mouse.position.tile,
        to: uiState.mouse.position.tile
      });
    }
  }
};

const dblclick: ModeActionsAction = ({ uiState, scene, mouse }) => {
  if (uiState.mode.type !== 'CURSOR') return;

  const itemAtTile = getItemAtTile({
    tile: mouse.position.tile,
    scene
  });

  if (!itemAtTile) {
    uiState.actions.setContextMenu({
      tile: mouse.position.tile,
      type: 'create'
    });
    return;
  }

  if (itemAtTile.type === 'ITEM') {
    const cellTile = mouse.position.tile;

    scene.createRectangle({
      id: generateId(),
      color: DEFAULT_COLOR.id,
      from: { x: cellTile.x - 1, y: cellTile.y - 1 },
      to: { x: cellTile.x + 1, y: cellTile.y + 1 }
    });
  }
};

export const Cursor: ModeActions = {
  entry: (state) => {
    const { uiState } = state;

    if (uiState.mode.type !== 'CURSOR') return;

    if (uiState.mode.mousedownItem) {
      mousedown(state);
    }
  },
  dblclick,
  mousemove: ({ scene, uiState, mouse }) => {
    if (uiState.mode.type !== 'CURSOR') return;

    // Right-click drag: pan the map
    if (mouse.mousedown?.button === 2) {
      const deltaScreen = mouse.delta?.screen;
      if (deltaScreen) {
        const newScroll = produce(uiState.scroll, (draft) => {
          draft.position = CoordsUtils.add(draft.position, deltaScreen);
        });
        uiState.actions.setScroll(newScroll);
      }
      return;
    }

    // Left-click drag on empty space: update rubber band
    if (!uiState.mode.mousedownItem && uiState.rubberBand) {
      uiState.actions.setRubberBand(
        produce(uiState.rubberBand, (draft) => {
          draft.to = mouse.position.tile;
        })
      );
      return;
    }

    if (!hasMovedTile(mouse)) return;

    let item = uiState.mode.mousedownItem;

    if (item?.type === 'CONNECTOR' && mouse.mousedown) {
      const anchor = getAnchor(item.id, mouse.mousedown.tile, scene);

      item = {
        type: 'CONNECTOR_ANCHOR',
        id: anchor.id
      };
    }

    if (item) {
      uiState.actions.setMode({
        type: 'DRAG_ITEMS',
        showCursor: true,
        items: [item],
        isInitialMovement: true
      });
    }
  },
  mousedown,
  mouseup: ({ uiState, mouse, isRendererInteraction, scene }) => {
    if (uiState.mode.type !== 'CURSOR' || !isRendererInteraction) return;

    const clickedItem = uiState.mode.mousedownItem;
    const button = mouse.mousedown?.button;
    const isCtrl = mouse.ctrlKey;
    const rubberBand = uiState.rubberBand;

    // Reset mousedownItem on mouseup
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
      })
    );

    // Right-click release: don't select items
    if (button === 2) return;

    // Rubber band selection: calculate selected items
    if (rubberBand) {
      const selected = getItemsInArea({
        from: rubberBand.from,
        to: rubberBand.to,
        scene
      });
      uiState.actions.setSelectedItems(selected);
      uiState.actions.setRubberBand(null);
      return;
    }

    // Ctrl+Click: don't set itemControls (multi-selection handled in mousedown)
    if (isCtrl) return;

    if (clickedItem) {
      if (clickedItem.type === 'ITEM') {
        uiState.actions.setItemControls({
          type: 'ITEM',
          id: clickedItem.id
        });
      } else if (clickedItem.type === 'RECTANGLE') {
        uiState.actions.setItemControls({
          type: 'RECTANGLE',
          id: clickedItem.id
        });
      } else if (clickedItem.type === 'CONNECTOR') {
        uiState.actions.setItemControls({
          type: 'CONNECTOR',
          id: clickedItem.id
        });
      } else if (clickedItem.type === 'TEXTBOX') {
        uiState.actions.setItemControls({
          type: 'TEXTBOX',
          id: clickedItem.id
        });
      }
    } else if (button === 0) {
      uiState.actions.setItemControls(null);
      uiState.actions.setSelectedItems([]);
    }
  }
};
