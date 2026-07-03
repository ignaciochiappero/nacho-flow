import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { toPx, CoordsUtils } from 'src/utils';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useTextBoxProps } from 'src/hooks/useTextBoxProps';
import { useScene } from 'src/hooks/useScene';

interface Props {
  textBox: ReturnType<typeof useScene>['textBoxes'][0];
  isSelected?: boolean;
}

export const TextBox = ({ textBox, isSelected }: Props) => {
  const { paddingX, fontProps } = useTextBoxProps(textBox);

  const to = useMemo(() => {
    return CoordsUtils.add(textBox.tile, {
      x: textBox.size.width,
      y: 0
    });
  }, [textBox.tile, textBox.size.width]);

  const { css } = useIsoProjection({
    from: textBox.tile,
    to,
    orientation: textBox.orientation
  });

  return (
    <Box style={css}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          px: toPx(paddingX),
          border: isSelected ? '3px solid' : '2px solid transparent',
          borderColor: isSelected ? '#d32f2f' : 'transparent',
          borderRadius: '6px',
          bgcolor: isSelected ? 'rgba(211, 47, 47, 0.2)' : 'transparent',
          boxShadow: isSelected
            ? '0 0 0 3px rgba(211, 47, 47, 0.3), inset 0 0 8px rgba(211, 47, 47, 0.2)'
            : 'none'
        }}
      >
        <Typography
          sx={{
            ...fontProps
          }}
        >
          {textBox.content}
        </Typography>
      </Box>
    </Box>
  );
};
