import { supabase } from './supabaseClient';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: 'due_date' | 'renewal' | 'reservation' | 'limit_reached' | 'hold';
  read: boolean;
  created_at: string;
}

export type NotificationFilter = 'all' | 'unread' | 'read';

type Listener = () => void;

class NotificationStore {
  private items: NotificationItem[] = [];
  private listeners = new Set<Listener>();
  private currentUserId: string | null = null;
  private loaded = false;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  getNotifications(): NotificationItem[] {
    return [...this.items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getUnreadCount(): number {
    return this.items.filter((n) => !n.read).length;
  }

  async loadForUser(userId: string) {
    if (this.currentUserId === userId && this.loaded) return;
    this.currentUserId = userId;
    this.loaded = true;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      this.items = data as NotificationItem[];
    }
    this.emit();
  }

  async clearForUser() {
    this.currentUserId = null;
    this.loaded = false;
    this.items = [];
    this.emit();
  }

  async add(title: string, message: string, category: NotificationItem['category']) {
    if (!this.currentUserId) return;
    const { data, error } = await supabase
      .from('notifications')
      .insert({ title, message, category, user_id: this.currentUserId })
      .select()
      .single();
    if (!error && data) {
      this.items.unshift(data as NotificationItem);
      this.emit();
    }
  }

  async markAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (!error) {
      const item = this.items.find((n) => n.id === id);
      if (item) { item.read = true; this.emit(); }
    }
  }

  async markAllAsRead() {
    if (!this.currentUserId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', this.currentUserId)
      .eq('read', false);
    if (!error) {
      this.items.forEach((n) => { n.read = true; });
      this.emit();
    }
  }

  async clearAll() {
    if (!this.currentUserId) return;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', this.currentUserId);
    if (!error) {
      this.items = [];
      this.emit();
    }
  }
}

export const notificationStore = new NotificationStore();
