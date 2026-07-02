import React, { useCallback } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { getTilePosition, CoordsUtils, generateId } from 'src/utils';
import { useScene } from 'src/hooks/useScene';
import { TEXTBOX_DEFAULTS, VIEW_ITEM_DEFAULTS } from 'src/config';
import { ContextMenu } from './ContextMenu';

interface Props {
  anchorEl?: HTMLElement;
}

export const ContextMenuManager = ({ anchorEl }: Props) => {
  const scene = useScene();
  const zoom = useUiStateStore((state) => {
    return state.zoom;
  });
  const contextMenu = useUiStateStore((state) => {
    return state.contextMenu;
  });

  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const onClose = useCallback(() => {
    uiStateActions.setContextMenu(null);
  }, [uiStateActions]);

  if (!contextMenu) {
    return null;
  }

  const isCreateMode = contextMenu.type === 'create';

  const menuItems = isCreateMode
    ? [
        {
          label: 'Add Icon',
          onClick: () => {
            const id = generateId();
            scene.createModelItem({
              id,
              name: 'Untitled',
              icon: 'block'
            });
            scene.createViewItem({
              ...VIEW_ITEM_DEFAULTS,
              id,
              tile: contextMenu.tile
            });
            uiStateActions.setItemControls({ type: 'ITEM', id });
            onClose();
          }
        },
        {
          label: 'Add Rectangle',
          onClick: () => {
            const id = generateId();
            scene.createRectangle({
              id,
              color: scene.colors[0].id,
              from: contextMenu.tile,
              to: contextMenu.tile
            });
            uiStateActions.setItemControls({ type: 'RECTANGLE', id });
            onClose();
          }
        },
        {
          label: 'Add TextBox',
          onClick: () => {
            const id = generateId();
            scene.createTextBox({
              ...TEXTBOX_DEFAULTS,
              id,
              tile: contextMenu.tile
            });
            uiStateActions.setItemControls({ type: 'TEXTBOX', id });
            onClose();
          }
        }
      ]
    : [
        {
          label: 'Send backward',
          onClick: () => {
            scene.changeLayerOrder('SEND_BACKWARD', contextMenu.item!);
            onClose();
          }
        },
        {
          label: 'Bring forward',
          onClick: () => {
            scene.changeLayerOrder('BRING_FORWARD', contextMenu.item!);
            onClose();
          }
        },
        {
          label: 'Send to back',
          onClick: () => {
            scene.changeLayerOrder('SEND_TO_BACK', contextMenu.item!);
            onClose();
          }
        },
        {
          label: 'Bring to front',
          onClick: () => {
            scene.changeLayerOrder('BRING_TO_FRONT', contextMenu.item!);
            onClose();
          }
        }
      ];

  return (
    <ContextMenu
      anchorEl={anchorEl}
      onClose={onClose}
      position={CoordsUtils.multiply(
        getTilePosition({ tile: contextMenu.tile }),
        zoom
      )}
      menuItems={menuItems}
    />
  );
};
