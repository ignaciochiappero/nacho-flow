import { parseAndPrepareModel, fixModel } from '../model';
import { model as modelFixture } from '../../fixtures/model';

describe('parseAndPrepareModel', () => {
  test('accepts a valid model fixture', () => {
    const result = parseAndPrepareModel(modelFixture);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual(modelFixture.items);
      expect(result.data.views.length).toBeGreaterThan(0);
    }
  });

  test('merges missing fields with INITIAL_DATA defaults', () => {
    const result = parseAndPrepareModel({
      title: 'Partial model',
      items: modelFixture.items,
      icons: modelFixture.icons,
      colors: modelFixture.colors,
      views: modelFixture.views
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Partial model');
      expect(result.data.items).toEqual(modelFixture.items);
    }
  });

  test('rejects invalid payloads', () => {
    const result = parseAndPrepareModel(null);

    expect(result.success).toBe(false);
  });

  test('fixModel removes connectors with too few anchors', () => {
    const brokenModel = {
      ...modelFixture,
      views: [
        {
          ...modelFixture.views[0],
          connectors: [
            {
              id: 'broken-connector',
              color: 'color1',
              anchors: []
            }
          ]
        }
      ]
    };

    const fixed = fixModel(brokenModel);
    const result = parseAndPrepareModel(fixed);

    expect(result.success).toBe(true);
  });
});
