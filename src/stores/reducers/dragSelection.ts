import { produce } from 'immer';
import { Coords, ItemReference, View } from 'src/types';
import {
  CoordsUtils,
  getConnectorsByViewItem,
  getItemByIdOrThrow,
  moveConnectorByDelta,
  getAnchorTile,
  isWithinBounds,
  getBoundingBox,
  getConnectorPath
} from 'src/utils';
import { syncConnector } from './connector';
import { State, ViewReducerContext } from './types';

const itemKey = (item: ItemReference) => {
  return `${item.type}:${item.id}`;
};

const tileKey = (tile: Coords) => {
  return `${tile.x},${tile.y}`;
};

const getAttachedItemIds = (items: ItemReference[]) => {
  return new Set(
    items
      .filter((item) => {
        return item.type === 'ITEM';
      })
      .map((item) => {
        return item.id;
      })
  );
};

const expandDragItems = (items: ItemReference[], view: View): ItemReference[] => {
  const expanded = new Map<string, ItemReference>();

  items.forEach((item) => {
    expanded.set(itemKey(item), item);
  });

  const draggedRectangles = items.filter((item) => {
    return item.type === 'RECTANGLE';
  });

  if (draggedRectangles.length === 0) {
    return [...expanded.values()];
  }

  draggedRectangles.forEach((rectRef) => {
    const rectangle = view.rectangles?.find((candidate) => {
      return candidate.id === rectRef.id;
    });

    if (!rectangle) {
      return;
    }

    const bounds = getBoundingBox([rectangle.from, rectangle.to]);

    (view.items ?? []).forEach((viewItem) => {
      if (isWithinBounds(viewItem.tile, bounds)) {
        expanded.set(itemKey({ type: 'ITEM', id: viewItem.id }), {
          type: 'ITEM',
          id: viewItem.id
        });
      }
    });

    (view.textBoxes ?? []).forEach((textBox) => {
      if (isWithinBounds(textBox.tile, bounds)) {
        expanded.set(itemKey({ type: 'TEXTBOX', id: textBox.id }), {
          type: 'TEXTBOX',
          id: textBox.id
        });
      }
    });

    (view.connectors ?? []).forEach((connector) => {
      const isInside = connector.anchors.some((anchor) => {
        return isWithinBounds(getAnchorTile(anchor, view), bounds);
      });

      if (isInside) {
        expanded.set(itemKey({ type: 'CONNECTOR', id: connector.id }), {
          type: 'CONNECTOR',
          id: connector.id
        });
      }
    });
  });

  return [...expanded.values()];
};

const collectConnectorIds = (
  items: ItemReference[],
  view: View
): Set<string> => {
  const connectorIds = new Set<string>();

  items.forEach((item) => {
    if (item.type === 'CONNECTOR') {
      connectorIds.add(item.id);
    }

    if (item.type === 'ITEM') {
      const connected = getConnectorsByViewItem(item.id, view.connectors ?? []);
      connected.forEach(
        (connector) => {
          connectorIds.add(connector.id);
        }
      );
    }
  });

  return connectorIds;
};

const expandTileLinkedConnectorIds = (
  connectorIds: Set<string>,
  view: View
): Set<string> => {
  const expanded = new Set(connectorIds);
  const connectors = view.connectors ?? [];
  const movingTiles = new Set<string>();

  connectorIds.forEach((connectorId) => {
    const connector = connectors.find((candidate) => {
      return candidate.id === connectorId;
    });

    connector?.anchors.forEach((anchor) => {
      if (anchor.ref.tile) {
        movingTiles.add(tileKey(getAnchorTile(anchor, view)));
      }
    });
  });

  connectors.forEach((connector) => {
    if (expanded.has(connector.id)) {
      return;
    }

    const sharesTile = connector.anchors.some((anchor) => {
      return (
        Boolean(anchor.ref.tile) &&
        movingTiles.has(tileKey(getAnchorTile(anchor, view)))
      );
    });

    if (sharesTile) {
      expanded.add(connector.id);
    }
  });

  return expanded;
};

const expandLinkedConnectorIds = (
  connectorIds: Set<string>,
  view: View
): Set<string> => {
  const expanded = new Set(connectorIds);
  const connectors = view.connectors ?? [];
  let changed = true;

  while (changed) {
    changed = false;
    const anchorIds = new Set<string>();
    const anchorTiles = new Set<string>();

    expanded.forEach((connectorId) => {
      const connector = connectors.find((candidate) => {
        return candidate.id === connectorId;
      });

      connector?.anchors.forEach((anchor) => {
        anchorIds.add(anchor.id);
        anchorTiles.add(tileKey(getAnchorTile(anchor, view)));
      });
    });

    connectors.forEach((connector) => {
      if (expanded.has(connector.id)) {
        return;
      }

      const isLinked = connector.anchors.some((anchor) => {
        if (anchor.ref.anchor && anchorIds.has(anchor.ref.anchor)) {
          return true;
        }

        return anchorTiles.has(tileKey(getAnchorTile(anchor, view)));
      });

      if (isLinked) {
        expanded.add(connector.id);
        changed = true;
      }
    });
  }

  return expanded;
};

export const resolveDragConnectors = (items: ItemReference[], view: View) => {
  const expandedItems = expandDragItems(items, view);
  const rawConnectorIds = collectConnectorIds(expandedItems, view);
  const connectorIdsToMove = expandTileLinkedConnectorIds(rawConnectorIds, view);
  const connectorIdsToSync = expandLinkedConnectorIds(connectorIdsToMove, view);

  return {
    expandedItems,
    attachedItemIds: getAttachedItemIds(expandedItems),
    connectorIdsToMove,
    connectorIdsToSync
  };
};

export const applyDragDelta = (
  items: ItemReference[],
  delta: Coords,
  ctx: ViewReducerContext
): State => {
  const viewSnapshot = getItemByIdOrThrow(
    ctx.state.model.views,
    ctx.viewId
  ).value;
  const {
    expandedItems,
    attachedItemIds,
    connectorIdsToMove,
    connectorIdsToSync
  } = resolveDragConnectors(items, viewSnapshot);

  const syncOnlyIds = [...connectorIdsToSync].filter((connectorId) => {
    return !connectorIdsToMove.has(connectorId);
  });

  const stateAfterMove = produce(ctx.state, (draft) => {
    const draftView = getItemByIdOrThrow(draft.model.views, ctx.viewId);

    expandedItems.forEach((item) => {
      if (item.type === 'ITEM') {
        const viewItem = getItemByIdOrThrow(draftView.value.items, item.id);
        viewItem.value.tile = CoordsUtils.add(viewItem.value.tile, delta);
      }

      if (item.type === 'RECTANGLE') {
        const rectangle = getItemByIdOrThrow(
          draftView.value.rectangles ?? [],
          item.id
        );
        rectangle.value.from = CoordsUtils.add(rectangle.value.from, delta);
        rectangle.value.to = CoordsUtils.add(rectangle.value.to, delta);
      }

      if (item.type === 'TEXTBOX') {
        const textBox = getItemByIdOrThrow(
          draftView.value.textBoxes ?? [],
          item.id
        );
        textBox.value.tile = CoordsUtils.add(textBox.value.tile, delta);
      }
    });

    connectorIdsToMove.forEach((connectorId) => {
      const connector = getItemByIdOrThrow(
        draftView.value.connectors ?? [],
        connectorId
      );

      draftView.value.connectors![connector.index] = moveConnectorByDelta(
        connector.value,
        delta,
        viewSnapshot,
        { attachedItemIds }
      );
    });

    connectorIdsToMove.forEach((connectorId) => {
      const connector = getItemByIdOrThrow(
        draftView.value.connectors ?? [],
        connectorId
      );

      // Recompute path from updated anchors + item positions (realtime)
      // instead of translating the old path, so connectors stay connected
      // to non-dragged items during the drag.
      draft.scene.connectors[connectorId] = {
        path: getConnectorPath({
          anchors: connector.value.anchors,
          view: draftView.value
        })
      };
    });
  });

  return syncOnlyIds.reduce((acc, connectorId) => {
    return syncConnector(connectorId, {
      viewId: ctx.viewId,
      state: acc
    });
  }, stateAfterMove);
};

export const syncDragConnectors = (
  items: ItemReference[],
  ctx: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(ctx.state.model.views, ctx.viewId).value;
  const { connectorIdsToSync } = resolveDragConnectors(items, view);

  return [...connectorIdsToSync].reduce((acc, connectorId) => {
    return syncConnector(connectorId, {
      viewId: ctx.viewId,
      state: acc
    });
  }, ctx.state);
};

export const getSelectedConnectorIdsFromItems = (items: ItemReference[]) => {
  return new Set(
    items
      .filter((item) => {
        return item.type === 'CONNECTOR';
      })
      .map((item) => {
        return item.id;
      })
  );
};
