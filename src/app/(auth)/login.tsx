import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Field, Screen } from '@/components/ui';

export default function LoginScreen() {
  const { signIn, signInWithGoogle, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal masuk');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <BrandLogo width={240} />
        <Text style={styles.tag}>Belajar Al-Qur'an kata per kata, dengan warna metode Tamyiz.</Text>
      </View>
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field label="Kata sandi" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Masuk" loading={loading} onPress={submit} />
      <Button
        label="Masuk dengan Google"
        tone="ghost"
        onPress={() => {
          setError(null);
          void signInWithGoogle().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Google gagal'));
        }}
      />
      <Link href="/(auth)/forgot" style={styles.link}>
        Lupa kata sandi
      </Link>
      <Link href="/(auth)/register" style={styles.link}>
        Belum punya akun? Daftar
      </Link>
      {!configured ? (
        <Text style={styles.hint}>Mode demo aktif. Akun admin: admin@tamyiz.test. Kata sandi apa saja, minimal 6 karakter.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6, marginBottom: 8, marginTop: 12, alignItems: 'center' },
  tag: { color: colors.muted, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  error: { color: colors.danger },
  link: { color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
