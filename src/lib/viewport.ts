import { useWindowDimensions } from 'react-native';

export type ViewportTier = 'compact' | 'medium' | 'expanded';

export function useViewport() {
  const { width, height } = useWindowDimensions();
  const phone = width < 768;
  const tier: ViewportTier = phone ? 'compact' : width <= 1024 ? 'medium' : 'expanded';
  return {
    width,
    height,
    tier,
    phone,
    compact: tier === 'compact',
    medium: tier === 'medium',
    expanded: tier === 'expanded',
    gutter: tier === 'compact' ? 16 : tier === 'medium' ? 24 : 32,
    contentMax: tier === 'expanded' ? 900 : 840,
    columns: tier === 'compact' ? 1 : tier === 'medium' ? 2 : 3,
  };
}
