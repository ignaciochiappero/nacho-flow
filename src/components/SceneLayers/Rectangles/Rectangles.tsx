import React from 'react';
import { useScene } from 'src/hooks/useScene';
import { ItemReference } from 'src/types';
import { Rectangle } from './Rectangle';

interface Props {
  rectangles: ReturnType<typeof useScene>['rectangles'];
  selectedItems?: ItemReference[];
}

export const Rectangles = ({ rectangles, selectedItems = [] }: Props) => {
  return (
    <>
      {[...rectangles].reverse().map((rectangle) => {
        const isSelected = selectedItems.some(
          (item) => item.type === 'RECTANGLE' && item.id === rectangle.id
        );
        return (
          <Rectangle
            key={rectangle.id}
            {...rectangle}
            isSelected={isSelected}
          />
        );
      })}
    </>
  );
};
