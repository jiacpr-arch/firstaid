import { create } from 'zustand'
import { getLessonProgress } from '../db/database'

export const useProgressStore = create((set) => ({
  readLessonIds: new Set(),
  loading: false,
  refresh: async (learnerId) => {
    if (!learnerId) {
      set({ readLessonIds: new Set() })
      return
    }
    set({ loading: true })
    const rows = await getLessonProgress(learnerId)
    set({ readLessonIds: new Set(rows.map(r => r.lessonId)), loading: false })
  },
  markRead: (lessonId) =>
    set((s) => {
      const next = new Set(s.readLessonIds)
      next.add(lessonId)
      return { readLessonIds: next }
    }),
}))
