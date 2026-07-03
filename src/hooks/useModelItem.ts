import { useMemo } from 'react';
import { ModelItem } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';

export const useModelItem = (id: string): ModelItem | undefined => {
  const model = useModelStore((state) => {
    return state;
  });

  const modelItem = useMemo(() => {
    return model.items.filter(Boolean).find((item) => item.id === id);
  }, [id, model.items]);

  return modelItem;
};
