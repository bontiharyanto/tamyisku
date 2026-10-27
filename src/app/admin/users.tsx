import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { isSubscriptionActive, roleLabel } from '@/lib/types';
import { colors, latinFont } from '@/lib/theme';
import { DataGrid } from '@/components/DataGrid';
import { Button, Field, Screen, SkeletonList } from '@/components/ui';

export default function AdminUsers() {
  const { dataVersion } = useAuth();
  const catalog = useAdminUsers(dataVersion);

  return (
    <Screen>
      <Field label="Cari email atau nama" value={catalog.search} onChangeText={catalog.setSearch} autoCapitalize="none" />
      <Button label="Cari" tone="ghost" onPress={() => void catalog.load(catalog.search)} />
      {catalog.loading ? <SkeletonList count={4} /> : (
        <DataGrid
          rows={catalog.users}
          emptyLabel="Pengguna tidak ditemukan"
          columns={[
            { key: 'name', label: 'Nama', minWidth: 180, render: (user) => <Text style={styles.name}>{user.fullName || '—'}</Text> },
            { key: 'email', label: 'Email', minWidth: 220, render: (user) => <Text style={styles.email}>{user.email}</Text> },
            { key: 'role', label: 'Peran', minWidth: 110, render: (user) => <Text style={styles.meta}>{roleLabel(user.role)}</Text> },
            { key: 'plan', label: 'Langganan', minWidth: 120, render: (user) => <Text style={styles.meta}>{isSubscriptionActive(user.subscription) ? 'Premium' : user.subscription.status}</Text> },
            {
              key: 'action',
              label: 'Aksi',
              minWidth: 360,
              render: (user) => (
                <View style={styles.actions}>
                  <Button label="Santri" tone={user.role === 'user' ? 'primary' : 'ghost'} loading={catalog.busyId === user.id} onPress={() => void catalog.assignRole(user, 'user')} />
                  <Button label="Pengajar" tone={user.role === 'tutor' ? 'primary' : 'ghost'} loading={catalog.busyId === user.id} onPress={() => void catalog.assignRole(user, 'tutor')} />
                  <Button label="Admin" tone={user.role === 'admin' ? 'primary' : 'ghost'} loading={catalog.busyId === user.id} onPress={() => void catalog.assignRole(user, 'admin')} />
                  <Button
                    label={isSubscriptionActive(user.subscription) ? 'Nonaktifkan' : 'Aktifkan 30 hari'}
                    tone={isSubscriptionActive(user.subscription) ? 'danger' : 'primary'}
                    loading={catalog.busyId === user.id}
                    onPress={() => void catalog.toggle(user)}
                  />
                </View>
              ),
            },
          ]}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...latinFont, fontWeight: '800', fontSize: 15 },
  email: { ...latinFont, color: colors.muted },
  meta: { ...latinFont, color: colors.primary, fontWeight: '700' },
  actions: { gap: 8 },
});
