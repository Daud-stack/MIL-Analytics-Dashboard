'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (n) => {
        const notification: AppNotification = {
          ...n,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date(),
          read: false,
        };
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 100), // Keep max 100
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      clearAll: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'avenues-notifications',
    }
  )
);
