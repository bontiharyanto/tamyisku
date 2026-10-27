import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { BootScreen } from '@/components/ui';

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) return <BootScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(main)" />;
}
