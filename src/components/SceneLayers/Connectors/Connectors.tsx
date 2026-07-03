import React, { useMemo } from 'react';
import type { useScene } from 'src/hooks/useScene';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { ItemReference } from 'src/types';
import { Connector } from './Connector';

interface Props {
  connectors: ReturnType<typeof useScene>['connectors'];
  selectedItems?: ItemReference[];
}

export const Connectors = ({ connectors, selectedItems = [] }: Props) => {
  const itemControls = useUiStateStore((state) => {
    return state.itemControls;
  });

  const mode = useUiStateStore((state) => {
    return state.mode;
  });

  const selectedConnectorId = useMemo(() => {
    if (mode.type === 'CONNECTOR') {
      return mode.id;
    }
    if (itemControls?.type === 'CONNECTOR') {
      return itemControls.id;
    }

    return null;
  }, [mode, itemControls]);

  return (
    <>
      {[...connectors].reverse().map((connector) => {
        const isSelectedByMultiSelect = selectedItems.some(
          (item) => item.type === 'CONNECTOR' && item.id === connector.id
        );
        return (
          <Connector
            key={connector.id}
            connector={connector}
            isSelected={selectedConnectorId === connector.id || isSelectedByMultiSelect}
          />
        );
      })}
    </>
  );
};
