import { create } from "zustand";

interface FilterState {
  year: number;
  month: string;
  compareYear?: number;
  isOnline: boolean;
  setYear: (year: number) => void;
  setMonth: (month: string) => void;
  setCompareYear: (year: number | undefined) => void;
  setIsOnline: (online: boolean) => void;
}

const currentYear = new Date().getFullYear();

export const useFilterStore = create<FilterState>((set) => ({
  year: currentYear,
  month: "Full Year",
  compareYear: undefined,
  isOnline: true,
  setYear: (year: number) => set({ year }),
  setMonth: (month: string) => set({ month }),
  setCompareYear: (compareYear: number | undefined) => set({ compareYear }),
  setIsOnline: (isOnline: boolean) => set({ isOnline }),
}));
