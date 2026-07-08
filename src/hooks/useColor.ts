import { useMemo } from 'react';
import { useScene } from 'src/hooks/useScene';

export const useColor = (colorId?: string) => {
  const { colors } = useScene();

  const color = useMemo(() => {
    if (colors.length === 0) {
      return { id: '__fallback__', value: '#999999' };
    }

    if (colorId === undefined) {
      return colors[0];
    }

    const found = colors.find((c) => c.id === colorId);
    return found ?? colors[0];
  }, [colorId, colors]);

  return color;
};
