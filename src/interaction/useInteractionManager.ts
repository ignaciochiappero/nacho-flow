import { useCallback, useEffect, useRef } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { initUndoRedo, performUndo, performRedo } from 'src/stores/undoRedoStore';
import { ModeActions, State, SlimMouseEvent, ItemControls } from 'src/types';
import { getMouse, getItemAtTile } from 'src/utils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { useScene } from 'src/hooks/useScene';
import { Cursor } from './modes/Cursor';
import { DragItems } from './modes/DragItems';
import { DrawRectangle } from './modes/Rectangle/DrawRectangle';
import { TransformRectangle } from './modes/Rectangle/TransformRectangle';
import { Connector } from './modes/Connector';
import { Pan } from './modes/Pan';
import { PlaceIcon } from './modes/PlaceIcon';
import { TextBox } from './modes/TextBox';

const modes: { [k in string]: ModeActions } = {
  CURSOR: Cursor,
  DRAG_ITEMS: DragItems,
  // TODO: Adopt this notation for all modes (i.e. {node.type}.{action})
  'RECTANGLE.DRAW': DrawRectangle,
  'RECTANGLE.TRANSFORM': TransformRectangle,
  CONNECTOR: Connector,
  PAN: Pan,
  PLACE_ICON: PlaceIcon,
  TEXTBOX: TextBox
};

const getModeFunction = (mode: ModeActions, e: SlimMouseEvent) => {
  switch (e.type) {
    case 'mousemove':
      return mode.mousemove;
    case 'mousedown':
      return mode.mousedown;
    case 'mouseup':
      return mode.mouseup;
    case 'dblclick':
      return mode.dblclick;
    default:
      return null;
  }
};

export const useInteractionManager = () => {
  const rendererRef = useRef<HTMLElement>();
  const reducerTypeRef = useRef<string>();
  const rightClickStartRef = useRef<{ x: number; y: number } | null>(null);
  const uiState = useUiStateStore((state) => {
    return state;
  });
  const model = useModelStore((state) => {
    return state;
  });
  const scene = useScene();
  const { size: rendererSize } = useResizeObserver(uiState.rendererEl);

  const onMouseEvent = useCallback(
    (e: SlimMouseEvent) => {
      if (!rendererRef.current) return;

      // Track right-click start position for drag detection
      if (e.type === 'mousedown' && e.button === 2) {
        rightClickStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (e.type === 'mouseup') {
        rightClickStartRef.current = null;
      }

      const mode = modes[uiState.mode.type];
      const modeFunction = getModeFunction(mode, e);

      if (!modeFunction) return;

      const nextMouse = getMouse({
        interactiveElement: rendererRef.current,
        zoom: uiState.zoom,
        scroll: uiState.scroll,
        lastMouse: uiState.mouse,
        mouseEvent: e,
        rendererSize
      });

      uiState.actions.setMouse(nextMouse);

      const baseState: State = {
        model,
        scene,
        uiState,
        mouse: nextMouse,
        rendererRef: rendererRef.current,
        rendererSize,
        isRendererInteraction: rendererRef.current === e.target
      };

      if (reducerTypeRef.current !== uiState.mode.type) {
        const prevReducer = reducerTypeRef.current
          ? modes[reducerTypeRef.current]
          : null;

        if (prevReducer && prevReducer.exit) {
          prevReducer.exit(baseState);
        }

        if (mode.entry) {
          mode.entry(baseState);
        }
      }

      modeFunction(baseState);
      reducerTypeRef.current = uiState.mode.type;
    },
    [model, scene, uiState, rendererSize]
  );

  const onContextMenu = useCallback(
    (e: SlimMouseEvent) => {
      e.preventDefault();

      // Suppress context menu if user right-clicked and dragged (panned)
      if (rightClickStartRef.current) {
        const dx = e.clientX - rightClickStartRef.current.x;
        const dy = e.clientY - rightClickStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
          // Was a drag, not a click — suppress context menu
          rightClickStartRef.current = null;
          return;
        }
      }

      rightClickStartRef.current = null;

      const itemAtTile = getItemAtTile({
        tile: uiState.mouse.position.tile,
        scene
      });

      if (itemAtTile?.type === 'RECTANGLE') {
        uiState.actions.setContextMenu({
          item: itemAtTile,
          tile: uiState.mouse.position.tile
        });
      } else if (uiState.contextMenu) {
        uiState.actions.setContextMenu(null);
      }
    },
    [uiState.mouse, scene, uiState.contextMenu, uiState.actions]
  );

  useEffect(() => {
    initUndoRedo();
  }, []);

  useEffect(() => {
    if (uiState.mode.type === 'INTERACTIONS_DISABLED') return;

    const el = window;

    const onTouchStart = (e: TouchEvent) => {
      onMouseEvent({
        ...e,
        clientX: Math.floor(e.touches[0].clientX),
        clientY: Math.floor(e.touches[0].clientY),
        type: 'mousedown',
        button: 0
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      onMouseEvent({
        ...e,
        clientX: Math.floor(e.touches[0].clientX),
        clientY: Math.floor(e.touches[0].clientY),
        type: 'mousemove',
        button: 0
      });
    };

    const onTouchEnd = (e: TouchEvent) => {
      onMouseEvent({
        ...e,
        clientX: 0,
        clientY: 0,
        type: 'mouseup',
        button: 0
      });
    };

    const onScroll = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        uiState.actions.decrementZoom();
      } else {
        uiState.actions.incrementZoom();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        performRedo();
        return;
      }

      if (e.key !== 'Delete') return;

      const controls = uiState.itemControls;
      const selectedItems = uiState.selectedItems;

      // Multi-selection: delete all selected items
      if (selectedItems.length > 0) {
        for (const item of selectedItems) {
          try {
            switch (item.type) {
              case 'ITEM':
                scene.deleteViewItem(item.id);
                scene.deleteModelItem(item.id);
                break;
              case 'RECTANGLE':
                scene.deleteRectangle(item.id);
                break;
              case 'CONNECTOR':
                scene.deleteConnector(item.id);
                break;
              case 'TEXTBOX':
                scene.deleteTextBox(item.id);
                break;
            }
          } catch (e) {
            // Item may have already been deleted (e.g., connector deleted with rectangle)
            console.warn('Failed to delete item:', item.id, e);
          }
        }
        uiState.actions.setSelectedItems([]);
        uiState.actions.setItemControls(null);
        return;
      }

      // Single selection: delete item under controls
      if (!controls || controls.type === 'ADD_ITEM') return;

      const ref = controls as { type: string; id: string };

      switch (ref.type) {
        case 'ITEM':
          scene.deleteViewItem(ref.id);
          scene.deleteModelItem(ref.id);
          break;
        case 'RECTANGLE':
          scene.deleteRectangle(ref.id);
          break;
        case 'CONNECTOR':
          scene.deleteConnector(ref.id);
          break;
        case 'TEXTBOX':
          scene.deleteTextBox(ref.id);
          break;
      }

      uiState.actions.setItemControls(null);
    };

    el.addEventListener('mousemove', onMouseEvent);
    el.addEventListener('mousedown', onMouseEvent);
    el.addEventListener('mouseup', onMouseEvent);
    el.addEventListener('dblclick', onMouseEvent);
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove);
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('keydown', onKeyDown);
    uiState.rendererEl?.addEventListener('wheel', onScroll);

    return () => {
      el.removeEventListener('mousemove', onMouseEvent);
      el.removeEventListener('mousedown', onMouseEvent);
      el.removeEventListener('mouseup', onMouseEvent);
      el.removeEventListener('dblclick', onMouseEvent);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('keydown', onKeyDown);
      uiState.rendererEl?.removeEventListener('wheel', onScroll);
    };
  }, [
    uiState.editorMode,
    onMouseEvent,
    uiState.mode.type,
    onContextMenu,
    uiState.actions,
    uiState.rendererEl,
    uiState.itemControls,
    uiState.selectedItems,
    scene
  ]);

  const setInteractionsElement = useCallback((element: HTMLElement) => {
    rendererRef.current = element;
  }, []);

  return {
    setInteractionsElement
  };
};
