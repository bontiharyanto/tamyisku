import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, latinFont } from '@/lib/theme';
import { BootScreen, Button, Screen } from '@/components/ui';

export default function TutorLayout() {
  const { ready, user } = useAuth();
  const router = useRouter();
  if (!ready) return <BootScreen />;
  if (user?.role !== 'tutor' && user?.role !== 'admin') {
    return (
      <Screen edges={['top', 'bottom']}>
        <Text style={styles.denied}>Halaman ini untuk pengajar dan admin.</Text>
        <Button label="Kembali" onPress={() => router.replace('/(main)')} />
      </Screen>
    );
  }
  return (
    <View style={styles.body}>
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.white, headerTitleStyle: { ...latinFont, fontWeight: '700' } }}>
        <Stack.Screen name="lessons" options={{ title: 'Materi pengajar' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  denied: { ...latinFont, fontSize: 18, fontWeight: '800', color: colors.primary },
});
