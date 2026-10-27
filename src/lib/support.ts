import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const SUPPORT_CATEGORIES = [
  { id: 'pembayaran', label: 'Pembayaran' },
  { id: 'bug', label: 'Bug Aplikasi' },
  { id: 'materi', label: 'Pertanyaan Materi' },
  { id: 'lainnya', label: 'Lainnya' },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['id'];
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export type SupportTicket = {
  id: string;
  userId: string;
  email: string;
  category: SupportCategory;
  subject: string;
  description: string;
  attachmentUrl: string | null;
  status: TicketStatus;
  createdAt: string;
};

type DraftTicket = {
  category: SupportCategory;
  subject: string;
  description: string;
  attachmentUrl: string | null;
};

const demoTickets: SupportTicket[] = [];
const ticketListeners = new Set<() => void>();

function emitTickets() {
  ticketListeners.forEach((listener) => listener());
}

export function subscribeSupportTickets(listener: () => void) {
  ticketListeners.add(listener);
  return () => ticketListeners.delete(listener);
}

export function supportWhatsAppUrl() {
  const digits = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

export async function pickSupportImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Izinkan akses foto untuk mengunggah bukti.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

async function uploadAttachment(uri: string, userId: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('support_attachments').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function submitSupportTicket(input: {
  category: SupportCategory;
  subject: string;
  description: string;
  imageUri: string | null;
}) {
  const subject = input.subject.trim();
  const description = input.description.trim();
  if (subject.length < 3) throw new Error('Judul minimal 3 karakter');
  if (description.length < 10) throw new Error('Deskripsi minimal 10 karakter');

  if (!isSupabaseConfigured) {
    const ticket: SupportTicket = {
      id: `demo-${Date.now()}`,
      userId: 'demo',
      email: 'demo',
      category: input.category,
      subject,
      description,
      attachmentUrl: input.imageUri,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    demoTickets.unshift(ticket);
    emitTickets();
    return ticket.id;
  }

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error(authError?.message ?? 'Masuk terlebih dahulu');
  const attachmentUrl = input.imageUri ? await uploadAttachment(input.imageUri, auth.user.id) : null;
  const draft: DraftTicket = { category: input.category, subject, description, attachmentUrl };
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: auth.user.id,
      category: draft.category,
      subject: draft.subject,
      description: draft.description,
      attachment_url: draft.attachmentUrl,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const ticketId = String((data as { id: string }).id);
  await supabase.functions.invoke('notify-support-ticket', { body: { ticket_id: ticketId } }).catch(() => undefined);
  emitTickets();
  return ticketId;
}

export async function fetchOpenTicketCount() {
  if (!isSupabaseConfigured) return demoTickets.filter((ticket) => ticket.status === 'open').length;
  const { count, error } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  if (!isSupabaseConfigured) return demoTickets.map((ticket) => ({ ...ticket }));
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, user_id, category, subject, description, attachment_url, status, created_at, users(email)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const user = record.users as { email?: string } | { email?: string }[] | null;
    const email = Array.isArray(user) ? user[0]?.email : user?.email;
    return {
      id: String(record.id),
      userId: String(record.user_id),
      email: email ?? 'pengguna',
      category: record.category as SupportCategory,
      subject: String(record.subject),
      description: String(record.description),
      attachmentUrl: (record.attachment_url as string | null) ?? null,
      status: record.status as TicketStatus,
      createdAt: String(record.created_at),
    };
  });
}

export async function updateTicketStatus(id: string, status: TicketStatus) {
  if (!isSupabaseConfigured) {
    const ticket = demoTickets.find((item) => item.id === id);
    if (ticket) ticket.status = status;
    emitTickets();
    return;
  }
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  emitTickets();
}
