import { api } from './api';
import type { AppNotification, ApiResponse, Pagination } from '@/types';

export async function listNotifications(page = 1, limit = 30): Promise<{
  items: AppNotification[];
  unread: number;
  pagination: Pagination;
}> {
  const res = await api.get<ApiResponse<AppNotification[]>>('/notifications', {
    params: { page, limit },
  });
  return {
    items: res.data.data,
    unread: (res.data as any).unread ?? 0,
    pagination: res.data.pagination!,
  };
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.put('/notifications/read-all');
}

// Namespace-style export used by screens: notificationService.xxx(...)
export const notificationService = {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
