import { createStore } from 'zustand';
import { getModelStore } from './modelStore';
import { getSceneStore } from './sceneStore';
import { Model } from 'src/types';
import { Scene } from 'src/types/scene';

interface Snapshot {
  model: Pick<Model, 'items' | 'views' | 'icons' | 'colors'>;
  scene: Pick<Scene, 'connectors' | 'textBoxes'>;
}

interface UndoRedoState {
  past: Snapshot[];
  future: Snapshot[];
  push: (snapshot: Snapshot) => void;
  undo: () => Snapshot | null;
  redo: () => Snapshot | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const MAX_HISTORY = 50;

let lastSnapshot: Snapshot | null = null;
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

const createSnapshot = (): Snapshot => {
  const modelState = getModelStore().getState() as Model;
  const sceneState = getSceneStore().getState() as Scene;
  return {
    model: {
      items: modelState.items,
      views: modelState.views,
      icons: modelState.icons,
      colors: modelState.colors
    },
    scene: {
      connectors: sceneState.connectors,
      textBoxes: sceneState.textBoxes
    }
  };
};

const snapshotsEqual = (a: Snapshot, b: Snapshot): boolean => {
  return (
    JSON.stringify(a.model) === JSON.stringify(b.model) &&
    JSON.stringify(a.scene) === JSON.stringify(b.scene)
  );
};

export const undoRedoStore = createStore<UndoRedoState>((set, get) => ({
  past: [],
  future: [],
  push: (snapshot) => {
    const state = get();
    if (lastSnapshot && snapshotsEqual(snapshot, lastSnapshot)) return;
    lastSnapshot = snapshot;
    set({
      past: [...state.past.slice(-MAX_HISTORY + 1), snapshot],
      future: []
    });
  },
  undo: () => {
    const state = get();
    if (state.past.length === 0) return null;
    const previous = state.past[state.past.length - 1];
    const currentSnapshot = createSnapshot();
    set({
      past: state.past.slice(0, -1),
      future: [currentSnapshot, ...state.future]
    });
    lastSnapshot = previous;
    return previous;
  },
  redo: () => {
    const state = get();
    if (state.future.length === 0) return null;
    const next = state.future[0];
    const currentSnapshot = createSnapshot();
    set({
      past: [...state.past, currentSnapshot],
      future: state.future.slice(1)
    });
    lastSnapshot = next;
    return next;
  },
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => {
    lastSnapshot = null;
    set({ past: [], future: [] });
  }
}));

let isUndoing = false;

export const initUndoRedo = () => {
  const modelStore = getModelStore();
  const sceneStore = getSceneStore();

  const captureSnapshot = () => {
    if (isUndoing) return;
    const snapshot = createSnapshot();
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      undoRedoStore.getState().push(snapshot);
    }, 50);
  };

  modelStore.subscribe(captureSnapshot);
  sceneStore.subscribe(captureSnapshot);
};

export const performUndo = (): boolean => {
  const snapshot = undoRedoStore.getState().undo();
  if (!snapshot) return false;
  isUndoing = true;
  getModelStore().setState(snapshot.model);
  getSceneStore().setState(snapshot.scene);
  setTimeout(() => { isUndoing = false; }, 0);
  return true;
};

export const performRedo = (): boolean => {
  const snapshot = undoRedoStore.getState().redo();
  if (!snapshot) return false;
  isUndoing = true;
  getModelStore().setState(snapshot.model);
  getSceneStore().setState(snapshot.scene);
  setTimeout(() => { isUndoing = false; }, 0);
  return true;
};
