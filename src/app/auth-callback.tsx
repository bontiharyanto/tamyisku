import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { BootScreen } from '@/components/ui';

export default function AuthCallback() {
  const { ready, user } = useAuth();
  if (!ready) return <BootScreen label="Menyelesaikan masuk..." />;
  if (user) return <Redirect href="/(main)" />;
  return <Redirect href="/(auth)/login" />;
}
