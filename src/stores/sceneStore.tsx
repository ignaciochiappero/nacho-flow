import React, { createContext, useRef, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { SceneStore } from 'src/types';

const initialState = () => {
  return createStore<SceneStore>((set, get) => {
    return {
      connectors: {},
      textBoxes: {},
      actions: {
        get,
        set
      }
    };
  });
};

const SceneContext = createContext<ReturnType<typeof initialState> | null>(
  null
);

let sceneStoreRef: ReturnType<typeof initialState> | null = null;
export const getSceneStore = () => {
  if (!sceneStoreRef) throw new Error('SceneStore not initialized');
  return sceneStoreRef;
};

interface ProviderProps {
  children: React.ReactNode;
}

// TODO: Typings below are pretty gnarly due to the way Zustand works.
// see https://github.com/pmndrs/zustand/discussions/1180#discussioncomment-3439061
export const SceneProvider = ({ children }: ProviderProps) => {
  const storeRef = useRef<ReturnType<typeof initialState>>();

  if (!storeRef.current) {
    storeRef.current = initialState();
    sceneStoreRef = storeRef.current;
  }

  return (
    <SceneContext.Provider value={storeRef.current}>
      {children}
    </SceneContext.Provider>
  );
};

export function useSceneStore<T>(
  selector: (state: SceneStore) => T,
  equalityFn?: (left: T, right: T) => boolean
) {
  const store = useContext(SceneContext);

  if (store === null) {
    throw new Error('Missing provider in the tree');
  }

  const value = useStore(store, selector, equalityFn);

  return value;
}
