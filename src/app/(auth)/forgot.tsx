import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Field, Screen } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengirim tautan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BrandLogo width={160} />
      <Text style={styles.title}>Lupa kata sandi</Text>
      <Text style={styles.body}>Masukkan email akun. Tautan untuk membuat kata sandi baru dikirim ke email itu.</Text>
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {sent ? <Text style={styles.ok}>Tautan sudah dikirim. Periksa kotak masuk email Anda.</Text> : null}
      <Button label="Kirim tautan" loading={loading} onPress={() => void submit()} />
      <Link href="/(auth)/login" style={styles.link}>Kembali ke masuk</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginTop: 24 },
  body: { color: colors.muted, lineHeight: 22 },
  error: { color: colors.danger },
  ok: { color: colors.success, fontWeight: '700' },
  link: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
});
