import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { AdminDashboard } from '@/components/dashboard/admin';
import { DashboardErrorBoundary, DashboardShell } from '@/components/dashboard/shell';
import { StudentDashboard } from '@/components/dashboard/student';
import { TutorDashboard } from '@/components/dashboard/tutor';
import { BootScreen } from '@/components/ui';

export default function DashboardPage() {
  const { ready, user } = useAuth();
  if (!ready) return <BootScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return (
    <DashboardErrorBoundary>
      <DashboardShell role={user.role}>
        {user.role === 'admin' ? <AdminDashboard /> : user.role === 'tutor' ? <TutorDashboard /> : <StudentDashboard />}
      </DashboardShell>
    </DashboardErrorBoundary>
  );
}
