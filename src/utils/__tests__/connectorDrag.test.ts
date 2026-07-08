import { moveConnectorByDelta, getAnchorTile } from '../renderer';
import { model as modelFixture } from '../../fixtures/model';
import { CoordsUtils } from '../CoordsUtils';

describe('moveConnectorByDelta', () => {
  test('translates free tile anchors and detaches unselected item anchors', () => {
    const view = modelFixture.views[0];
    const connector = view.connectors?.[0];

    if (!connector) {
      throw new Error('Expected connector fixture');
    }

    const delta = { x: 2, y: 1 };
    const moved = moveConnectorByDelta(connector, delta, view);

    moved.anchors.forEach((anchor, index) => {
      const originalTile = getAnchorTile(connector.anchors[index], view);

      expect(anchor.ref.tile).toEqual(CoordsUtils.add(originalTile, delta));
    });
  });

  test('preserves item anchors when their nodes are also being dragged', () => {
    const view = modelFixture.views[0];
    const connector = view.connectors?.[0];

    if (!connector) {
      throw new Error('Expected connector fixture');
    }

    const delta = { x: 2, y: 1 };
    const moved = moveConnectorByDelta(connector, delta, view, {
      attachedItemIds: new Set(['node1', 'node2'])
    });

    expect(moved.anchors[0].ref.item).toBe('node1');
    expect(moved.anchors[1].ref.item).toBe('node2');
  });

  test('preserves chained anchor references at junctions', () => {
    const view = {
      ...modelFixture.views[0],
      connectors: [
        {
          id: 'main',
          color: 'color1',
          anchors: [
            { id: 'anch-item', ref: { item: 'node1' } },
            { id: 'anch-junction', ref: { tile: { x: 2, y: 0 } } }
          ]
        },
        {
          id: 'branch',
          color: 'color1',
          anchors: [
            { id: 'anch-link', ref: { anchor: 'anch-junction' } },
            { id: 'anch-end', ref: { item: 'node2' } }
          ]
        }
      ]
    };

    const delta = { x: 1, y: 1 };
    const movedBranch = moveConnectorByDelta(
      view.connectors![1],
      delta,
      view,
      { attachedItemIds: new Set(['node2']) }
    );

    expect(movedBranch.anchors[0].ref.anchor).toBe('anch-junction');
    expect(movedBranch.anchors[1].ref.item).toBe('node2');
  });
});
