import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/theme';
import { Button, Card, Screen } from '@/components/ui';

export default function AdminSettings() {
  const router = useRouter();
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Pengaturan</Text>
        <Text style={styles.body}>
          Audio kata diunggah ke bucket privat lesson-audio. Path yang diawali free/ dapat diputar tanpa langganan. Path lain hanya untuk pelanggan aktif dan admin.
        </Text>
        <Text style={styles.body}>
          Peran admin diubah dari SQL editor Supabase, bukan dari formulir ini, agar peran tidak bisa dinaikkan dari klien.
        </Text>
      </Card>
      <Button label="Kebijakan privasi & ketentuan" tone="ghost" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { color: colors.muted, lineHeight: 22 },
});