import { useCallback, useState } from 'react';
import { InitialData, IconCollectionState } from 'src/types';
import { INITIAL_DATA, INITIAL_SCENE_STATE } from 'src/config';
import {
  getFitToViewParams,
  CoordsUtils,
  categoriseIcons,
  generateId,
  getItemByIdOrThrow,
  parseAndPrepareModel,
  formatValidationErrors
} from 'src/utils';
import * as reducers from 'src/stores/reducers';
import { useModelStore } from 'src/stores/modelStore';
import { useView } from 'src/hooks/useView';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { undoRedoStore } from 'src/stores/undoRedoStore';

export type LoadOptions = {
  fitToView?: boolean;
  viewId?: string;
  resetUi?: boolean;
  clearUndo?: boolean;
};

export type LoadResult =
  | { success: true }
  | { success: false; message: string };

const ensureDefaultView = (initialData: InitialData): InitialData => {
  if (initialData.views.length > 0) {
    return initialData;
  }

  const updates = reducers.view({
    action: 'CREATE_VIEW',
    payload: {},
    ctx: {
      state: { model: initialData, scene: INITIAL_SCENE_STATE },
      viewId: generateId()
    }
  });

  return {
    ...initialData,
    ...updates.model
  };
};

export const useInitialDataManager = () => {
  const [isReady, setIsReady] = useState(false);
  const model = useModelStore((state) => {
    return state;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const rendererEl = useUiStateStore((state) => {
    return state.rendererEl;
  });
  const { changeView } = useView();

  const load = useCallback(
    (rawData: unknown, options: LoadOptions = {}): LoadResult => {
      if (rawData == null) {
        return { success: false, message: 'No model data provided.' };
      }

      uiStateActions.setIsModelLoading(true);
      setIsReady(false);

      const parsed = parseAndPrepareModel(rawData);

      if (!parsed.success) {
        setIsReady(true);
        uiStateActions.setIsModelLoading(false);
        return {
          success: false,
          message: formatValidationErrors(parsed.errors)
        };
      }

      const initialData = ensureDefaultView(parsed.data);

      if (options.clearUndo !== false) {
        undoRedoStore.getState().clear();
      }

      model.actions.set(initialData);

      const viewId =
        options.viewId ?? initialData.view ?? initialData.views[0].id;

      const view = getItemByIdOrThrow(initialData.views, viewId);

      changeView(view.value.id, initialData);

      if (options.resetUi !== false) {
        uiStateActions.resetUiState();
      }

      const shouldFitToView = options.fitToView ?? initialData.fitToView;

      if (shouldFitToView) {
        const rendererSize = rendererEl?.getBoundingClientRect();

        const { zoom, scroll } = getFitToViewParams(view.value, {
          width: rendererSize?.width ?? 0,
          height: rendererSize?.height ?? 0
        });

        uiStateActions.setScroll({
          position: scroll,
          offset: CoordsUtils.zero()
        });

        uiStateActions.setZoom(zoom);
      }

      const categoriesState: IconCollectionState[] = categoriseIcons(
        initialData.icons
      ).map((collection) => {
        return {
          id: collection.name,
          isExpanded: false
        };
      });

      uiStateActions.setIconCategoriesState(categoriesState);
      setIsReady(true);
      uiStateActions.setIsModelLoading(false);

      return { success: true };
    },
    [changeView, model.actions, rendererEl, uiStateActions]
  );

  const clear = useCallback(() => {
    load(
      { ...INITIAL_DATA, icons: model.icons, colors: model.colors },
      { resetUi: true, clearUndo: true }
    );
    uiStateActions.setCurrentProject(null, null);
  }, [load, model.icons, model.colors, uiStateActions]);

  return {
    load,
    clear,
    isReady
  };
};
