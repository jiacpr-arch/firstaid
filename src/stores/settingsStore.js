import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'system',
      fontScale: 1,
      houseAdDismissedAt: 0,
      setTheme: (theme) => set({ theme }),
      setFontScale: (fontScale) => set({ fontScale }),
      dismissHouseAd: () => set({ houseAdDismissedAt: Date.now() }),
    }),
    { name: 'firstaid.settings' },
  ),
)
