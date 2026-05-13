import { create } from "zustand";

type NotificationLevel = "info" | "success" | "warning" | "error";

type AnalysisNotification = {
  id: string;
  level: NotificationLevel;
  message: string;
};

type AnalysisNotificationStore = {
  notifications: AnalysisNotification[];
  pushNotification: (notification: AnalysisNotification) => void;
  dismissNotification: (id: string) => void;
};

export const useAnalysisNotificationStore = create<AnalysisNotificationStore>((set) => ({
  notifications: [],
  pushNotification: (notification) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    })),
}));
