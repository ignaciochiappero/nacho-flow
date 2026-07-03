import React from 'react';
import { ViewItem, ItemReference } from 'src/types';
import { Node } from './Node/Node';

interface Props {
  nodes: ViewItem[];
  selectedItems?: ItemReference[];
}

export const Nodes = ({ nodes, selectedItems = [] }: Props) => {
  return (
    <>
      {[...nodes].reverse().map((node) => {
        const isSelected = selectedItems.some(
          (item) => item.type === 'ITEM' && item.id === node.id
        );
        return (
          <Node
            key={node.id}
            order={-node.tile.x - node.tile.y}
            node={node}
            isSelected={isSelected}
          />
        );
      })}
    </>
  );
};
