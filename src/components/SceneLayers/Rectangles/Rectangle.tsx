import React from 'react';
import { useScene } from 'src/hooks/useScene';
import { IsoTileArea } from 'src/components/IsoTileArea/IsoTileArea';
import { getColorVariant } from 'src/utils';
import { useColor } from 'src/hooks/useColor';

type Props = ReturnType<typeof useScene>['rectangles'][0] & {
  isSelected?: boolean;
};

export const Rectangle = ({ from, to, color: colorId, isSelected }: Props) => {
  const color = useColor(colorId);

  return (
    <IsoTileArea
      from={from}
      to={to}
      fill={isSelected ? 'rgba(211, 47, 47, 0.25)' : color.value}
      cornerRadius={22}
      stroke={
        isSelected
          ? { color: '#d32f2f', width: 4 }
          : { color: getColorVariant(color.value, 'dark', { grade: 2 }), width: 1 }
      }
    />
  );
};
