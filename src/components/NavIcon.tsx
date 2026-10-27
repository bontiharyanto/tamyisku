import Svg, { Circle, Path } from 'react-native-svg';

export type NavIconName = 'home' | 'book' | 'award' | 'flame' | 'trophy' | 'settings';

export function NavIcon({ name, color, size = 22 }: { name: NavIconName; color: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' ? (
        <Path {...common} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      ) : null}
      {name === 'book' ? (
        <Path {...common} d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      ) : null}
      {name === 'award' ? (
        <>
          <Circle {...common} cx="12" cy="8" r="6" />
          <Path {...common} d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5" />
        </>
      ) : null}
      {name === 'flame' ? (
        <Path {...common} d="M12 3s6 5 6 10a6 6 0 0 1-12 0c0-2 1-3.5 2-4.5.2 2 1.5 3 2.5 3C10 9 11 6 12 3z" />
      ) : null}
      {name === 'trophy' ? (
        <Path {...common} d="M8 4h8v5a4 4 0 0 1-8 0zM8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v3M9 21h6M10 21a2 2 0 0 1 4 0" />
      ) : null}
      {name === 'settings' ? (
        <>
          <Circle {...common} cx="12" cy="12" r="3" />
          <Path {...common} d="M12 2.5v2.2M12 19.3V21.5M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6" />
        </>
      ) : null}
    </Svg>
  );
}
