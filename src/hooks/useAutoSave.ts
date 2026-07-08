import { useEffect, useRef, useCallback } from 'react';
import { Model } from 'src/types';
import { api } from 'src/services/api';

const DEBOUNCE_MS = 1000;

type SaveOptions = {
  force?: boolean;
};

export const useAutoSave = (
  model: Model,
  projectId: string | null,
  enabled: boolean = true
) => {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    lastSavedRef.current = '';
  }, [projectId]);

  const save = useCallback(
    async (modelToSave: Model, options: SaveOptions = {}): Promise<boolean> => {
      if (!projectId || !enabled) {
        return false;
      }

      const modelKey = JSON.stringify(modelToSave);

      if (!options.force && modelKey === lastSavedRef.current) {
        return true;
      }

      try {
        await api.updateProject(projectId, modelToSave);
        lastSavedRef.current = modelKey;
        return true;
      } catch (err) {
        console.error('Auto-save failed:', err);
        return false;
      }
    },
    [projectId, enabled]
  );

  useEffect(() => {
    if (!projectId || !enabled) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      save(model);
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [model, projectId, enabled, save]);

  const forceSave = useCallback(async (): Promise<boolean> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    return save(model, { force: true });
  }, [model, save]);

  return { forceSave };
};
