import { produce } from 'immer';
import { z } from 'zod';
import { InitialData, Model, ModelStore } from 'src/types';
import { INITIAL_DATA } from 'src/config';
import { modelSchema } from 'src/schemas/model';
import { validateModel } from 'src/schemas/validation';
import { getItemByIdOrThrow } from './common';

export type ModelParseResult =
  | { success: true; data: InitialData }
  | { success: false; errors: z.ZodIssue[] };

export const formatValidationErrors = (errors: z.ZodIssue[]): string => {
  return errors
    .map((error) => {
      const path = error.path.length > 0 ? `${error.path.join('.')}: ` : '';
      return `${path}${error.message}`;
    })
    .join('\n');
};

export const parseAndPrepareModel = (raw: unknown): ModelParseResult => {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      success: false,
      errors: [
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: 'Model must be a JSON object.'
        }
      ]
    };
  }

  const merged: InitialData = {
    ...INITIAL_DATA,
    ...(raw as InitialData)
  };

  let candidate: InitialData = merged;
  let result = modelSchema.safeParse(candidate);

  if (!result.success) {
    candidate = fixModel(candidate);
    result = modelSchema.safeParse(candidate);
  }

  if (!result.success) {
    return { success: false, errors: result.error.errors };
  }

  return {
    success: true,
    data: {
      ...INITIAL_DATA,
      ...result.data
    }
  };
};

export const fixModel = (model: Model): Model => {
  const issues = validateModel(model);

  return issues.reduce((acc, issue) => {
    if (issue.type === 'INVALID_MODEL_TO_ICON_REF') {
      return produce(acc, (draft) => {
        const { index: itemIndex } = getItemByIdOrThrow(
          draft.items,
          issue.params.modelItem
        );

        draft.items[itemIndex].icon = undefined;
      });
    }

    if (issue.type === 'CONNECTOR_TOO_FEW_ANCHORS') {
      return produce(acc, (draft) => {
        const view = getItemByIdOrThrow(draft.views, issue.params.view);

        const connector = getItemByIdOrThrow(
          view.value.connectors ?? [],
          issue.params.connector
        );

        draft.views[view.index].connectors?.splice(connector.index, 1);
      });
    }

    if (issue.type === 'INVALID_ANCHOR_TO_ANCHOR_REF') {
      return produce(acc, (draft) => {
        const view = getItemByIdOrThrow(draft.views, issue.params.view);

        const connector = getItemByIdOrThrow(
          view.value.connectors ?? [],
          issue.params.connector
        );

        const anchor = getItemByIdOrThrow(
          connector.value.anchors,
          issue.params.srcAnchor
        );

        connector.value.anchors.splice(anchor.index, 1);
      });
    }

    return acc;
  }, model);
};

export const modelFromModelStore = (modelStore: ModelStore): Model => {
  return {
    version: modelStore.version,
    title: modelStore.title,
    description: modelStore.description,
    colors: modelStore.colors,
    icons: modelStore.icons,
    items: modelStore.items,
    views: modelStore.views
  };
};
