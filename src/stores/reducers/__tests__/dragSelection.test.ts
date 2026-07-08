import { applyDragDelta } from '../dragSelection';
import { model as modelFixture } from 'src/fixtures/model';
import { INITIAL_SCENE_STATE } from 'src/config';
import { CoordsUtils, getAnchorTile } from 'src/utils';

jest.mock('../connector', () => ({
  syncConnector: (_id: string, ctx: { state: unknown }) => ctx.state
}));

describe('applyDragDelta', () => {
  test('keeps junction anchors aligned when items and connectors move together', () => {
    const view = {
      ...modelFixture.views[0],
      items: [
        { id: 'node-a', tile: { x: 0, y: 0 } },
        { id: 'node-b', tile: { x: 4, y: 0 } }
      ],
      connectors: [
        {
          id: 'branch-connector',
          color: 'color1',
          anchors: [
            { id: 'anch-a', ref: { item: 'node-a' } },
            { id: 'anch-junction', ref: { tile: { x: 2, y: 0 } } },
            { id: 'anch-b', ref: { item: 'node-b' } }
          ]
        }
      ]
    };

    const state = {
      model: { ...modelFixture, views: [view] },
      scene: INITIAL_SCENE_STATE
    };

    const delta = { x: 1, y: 1 };
    const result = applyDragDelta(
      [
        { type: 'ITEM', id: 'node-a' },
        { type: 'ITEM', id: 'node-b' },
        { type: 'CONNECTOR', id: 'branch-connector' }
      ],
      delta,
      { viewId: view.id, state }
    );

    const nextView = result.model.views[0];
    const connector = nextView.connectors?.[0];

    expect(nextView.items?.[0].tile).toEqual({ x: 1, y: 1 });
    expect(nextView.items?.[1].tile).toEqual({ x: 5, y: 1 });
    expect(connector?.anchors[1].ref.tile).toEqual({ x: 3, y: 1 });
    expect(getAnchorTile(connector!.anchors[0], nextView)).toEqual({
      x: 1,
      y: 1
    });
    expect(getAnchorTile(connector!.anchors[1], nextView)).toEqual({
      x: 3,
      y: 1
    });
    expect(getAnchorTile(connector!.anchors[2], nextView)).toEqual({
      x: 5,
      y: 1
    });
  });

  test('moves rectangle contents when only the rectangle is dragged', () => {
    const view = {
      ...modelFixture.views[0],
      items: [{ id: 'node-a', tile: { x: 1, y: 1 } }],
      rectangles: [
        {
          id: 'region',
          color: 'color1',
          from: { x: 0, y: 0 },
          to: { x: 4, y: 4 }
        }
      ],
      connectors: [
        {
          id: 'inner-connector',
          color: 'color1',
          anchors: [
            { id: 'anch-a', ref: { item: 'node-a' } },
            { id: 'anch-b', ref: { tile: { x: 3, y: 1 } } }
          ]
        }
      ]
    };

    const state = {
      model: { ...modelFixture, views: [view] },
      scene: INITIAL_SCENE_STATE
    };

    const delta = { x: 2, y: 2 };
    const result = applyDragDelta(
      [{ type: 'RECTANGLE', id: 'region' }],
      delta,
      { viewId: view.id, state }
    );

    const nextView = result.model.views[0];

    expect(nextView.items?.[0].tile).toEqual({ x: 3, y: 3 });
    expect(nextView.rectangles?.[0].from).toEqual({ x: 2, y: 2 });
    expect(getAnchorTile(nextView.connectors![0].anchors[0], nextView)).toEqual({
      x: 3,
      y: 3
    });
    expect(getAnchorTile(nextView.connectors![0].anchors[1], nextView)).toEqual({
      x: 5,
      y: 3
    });
  });

  test('translates connectors attached to dragged items from one snapshot', () => {
    const view = modelFixture.views[0];
    const state = {
      model: modelFixture,
      scene: INITIAL_SCENE_STATE
    };
    const connectorBefore = view.connectors?.[0];
    const delta = { x: 2, y: 1 };

    const result = applyDragDelta(
      [
        { type: 'ITEM', id: 'node1' },
        { type: 'ITEM', id: 'node2' },
        { type: 'CONNECTOR', id: 'connector1' }
      ],
      delta,
      { viewId: view.id, state }
    );

    const connectorAfter = result.model.views[0].connectors?.[0];

    expect(connectorAfter?.anchors[0].ref.item).toBe('node1');
    expect(connectorAfter?.anchors[1].ref.item).toBe('node2');
    expect(getAnchorTile(connectorAfter!.anchors[0], result.model.views[0])).toEqual(
      CoordsUtils.add(getAnchorTile(connectorBefore!.anchors[0], view), delta)
    );
    expect(getAnchorTile(connectorAfter!.anchors[1], result.model.views[0])).toEqual(
      CoordsUtils.add(getAnchorTile(connectorBefore!.anchors[1], view), delta)
    );
  });

  test('syncs linked branch connectors that share a junction anchor', () => {
    const view = {
      ...modelFixture.views[0],
      items: [
        { id: 'node-a', tile: { x: 0, y: 0 } },
        { id: 'node-b', tile: { x: 6, y: 0 } },
        { id: 'node-c', tile: { x: 3, y: -4 } }
      ],
      connectors: [
        {
          id: 'trunk',
          color: 'color1',
          anchors: [
            { id: 'anch-a', ref: { item: 'node-a' } },
            { id: 'anch-junction', ref: { tile: { x: 3, y: 0 } } },
            { id: 'anch-b', ref: { item: 'node-b' } }
          ]
        },
        {
          id: 'branch',
          color: 'color1',
          anchors: [
            { id: 'anch-link', ref: { anchor: 'anch-junction' } },
            { id: 'anch-c', ref: { item: 'node-c' } }
          ]
        }
      ]
    };

    const state = {
      model: { ...modelFixture, views: [view] },
      scene: INITIAL_SCENE_STATE
    };

    const delta = { x: 2, y: 2 };
    const result = applyDragDelta(
      [{ type: 'CONNECTOR', id: 'trunk' }],
      delta,
      { viewId: view.id, state }
    );

    const nextView = result.model.views[0];
    const branch = nextView.connectors?.find((connector) => {
      return connector.id === 'branch';
    });

    expect(branch?.anchors[0].ref.anchor).toBe('anch-junction');
    expect(getAnchorTile(branch!.anchors[0], nextView)).toEqual({ x: 5, y: 2 });
    expect(getAnchorTile(branch!.anchors[1], nextView)).toEqual({
      x: 3,
      y: -4
    });
  });

  test('translates cached scene paths during drag instead of re-pathfinding', () => {
    const view = modelFixture.views[0];
    const state = {
      model: modelFixture,
      scene: {
        ...INITIAL_SCENE_STATE,
        connectors: {
          connector1: {
            path: {
              tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
              rectangle: {
                from: { x: 4, y: 4 },
                to: { x: 0, y: 0 }
              }
            }
          }
        }
      }
    };
    const delta = { x: 2, y: 1 };

    const result = applyDragDelta(
      [
        { type: 'ITEM', id: 'node1' },
        { type: 'ITEM', id: 'node2' },
        { type: 'CONNECTOR', id: 'connector1' }
      ],
      delta,
      { viewId: view.id, state }
    );

    expect(result.scene.connectors.connector1.path.tiles).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ]);
    expect(result.scene.connectors.connector1.path.rectangle.from).toEqual({
      x: 6,
      y: 5
    });
  });
});
