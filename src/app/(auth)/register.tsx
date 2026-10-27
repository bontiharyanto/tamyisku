import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Field, Screen } from '@/components/ui';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await signUp(email, password, fullName);
      if (result === 'confirm') setInfo('Cek email untuk mengonfirmasi akun, lalu masuk.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BrandLogo width={180} />
      <Text style={styles.title}>Buat akun</Text>
      <Field label="Nama lengkap" value={fullName} onChangeText={setFullName} />
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field label="Kata sandi" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <Button label="Daftar" loading={loading} onPress={submit} />
      <Link href="/(auth)/login" style={styles.link}>
        Sudah punya akun? Masuk
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginTop: 24 },
  error: { color: colors.danger },
  info: { color: colors.primary },
  link: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
});
