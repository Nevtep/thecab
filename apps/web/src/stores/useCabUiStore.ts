import { create } from "zustand";

type CabUiStore = {
  sidebarCollapsed: boolean;
  selectedGlobalRange: "7d" | "30d" | "90d" | "365d";
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedGlobalRange: (range: CabUiStore["selectedGlobalRange"]) => void;
};

export const useCabUiStore = create<CabUiStore>((set) => ({
  sidebarCollapsed: false,
  selectedGlobalRange: "30d",
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedGlobalRange: (range) => set({ selectedGlobalRange: range }),
}));
