import React from 'react';
import { useScene } from 'src/hooks/useScene';
import { ItemReference } from 'src/types';
import { TextBox } from './TextBox';

interface Props {
  textBoxes: ReturnType<typeof useScene>['textBoxes'];
  selectedItems?: ItemReference[];
}

export const TextBoxes = ({ textBoxes, selectedItems = [] }: Props) => {
  return (
    <>
      {[...textBoxes].reverse().map((textBox) => {
        const isSelected = selectedItems.some(
          (item) => item.type === 'TEXTBOX' && item.id === textBox.id
        );
        return <TextBox key={textBox.id} textBox={textBox} isSelected={isSelected} />;
      })}
    </>
  );
};
