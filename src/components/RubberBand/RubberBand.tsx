import React from 'react';
import { useTheme } from '@mui/material';
import chroma from 'chroma-js';
import { IsoTileArea } from 'src/components/IsoTileArea/IsoTileArea';
import { useUiStateStore } from 'src/stores/uiStateStore';

export const RubberBand = () => {
  const theme = useTheme();
  const rubberBand = useUiStateStore((state) => {
    return state.rubberBand;
  });
  const zoom = useUiStateStore((state) => {
    return state.zoom;
  });

  if (!rubberBand) return null;

  return (
    <IsoTileArea
      from={rubberBand.from}
      to={rubberBand.to}
      fill="rgba(211, 47, 47, 0.2)"
      cornerRadius={10 * zoom}
      stroke={{
        color: '#d32f2f',
        width: 3
      }}
    />
  );
};
