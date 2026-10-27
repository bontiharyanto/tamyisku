import { useCallback, useEffect, useState } from 'react';
import { fetchManagedUsers, setSubscription, setUserRole } from '@/lib/api';
import type { ManagedUser, UserRole } from '@/lib/types';
import { isSubscriptionActive } from '@/lib/types';
import { notify } from '@/components/ui';

export function useAdminUsers(dataVersion: number) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      setUsers(await fetchManagedUsers(query));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('').catch((cause: unknown) => notify(cause instanceof Error ? cause.message : 'Gagal memuat', 'err'));
  }, [dataVersion, load]);

  async function toggle(user: ManagedUser) {
    setBusyId(user.id);
    try {
      await setSubscription(user.id, !isSubscriptionActive(user.subscription));
      await load(search);
      notify(isSubscriptionActive(user.subscription) ? 'Langganan dinonaktifkan' : 'Langganan diaktifkan 30 hari');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memperbarui', 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function assignRole(user: ManagedUser, role: UserRole) {
    setBusyId(user.id);
    try {
      await setUserRole(user.id, role);
      await load(search);
      notify('Peran diperbarui');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal mengubah peran', 'err');
    } finally {
      setBusyId(null);
    }
  }

  return { search, setSearch, users, busyId, loading, load, toggle, assignRole };
}
