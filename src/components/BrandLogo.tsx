import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

const LOCKUP = require('../../assets/logo.png');
const MARK = require('../../assets/mark.png');

export function BrandLogo({
  variant = 'lockup',
  width = 220,
  style,
}: {
  variant?: 'lockup' | 'mark';
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const source = variant === 'mark' ? MARK : LOCKUP;
  const height = Math.round(width * (variant === 'mark' ? 531 / 486 : 710 / 652));
  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="TamyisQ"
      source={source}
      resizeMode="contain"
      style={[styles.image, { width, height }, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: { alignSelf: 'center' },
});
