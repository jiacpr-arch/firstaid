import { create } from 'zustand'
import { getLessonProgress, getBestExam, getPassedScenarioIds } from '../db/database'

export const useProgressStore = create((set) => ({
  readLessonIds: new Set(),
  passedScenarioIds: new Set(),
  preTestDone: false,
  postTestDone: false,
  loaded: false,
  loading: false,
  refresh: async (learnerId) => {
    if (!learnerId) {
      set({
        readLessonIds: new Set(),
        passedScenarioIds: new Set(),
        preTestDone: false,
        postTestDone: false,
        loaded: true,
      })
      return
    }
    set({ loading: true })
    const [rows, pre, post, scenarioIds] = await Promise.all([
      getLessonProgress(learnerId),
      getBestExam(learnerId, 'pre'),
      getBestExam(learnerId, 'post'),
      getPassedScenarioIds(learnerId),
    ])
    set({
      readLessonIds: new Set(rows.map((r) => r.lessonId)),
      passedScenarioIds: new Set(scenarioIds),
      preTestDone: !!pre,
      postTestDone: !!post,
      loading: false,
      loaded: true,
    })
  },
  markRead: (lessonId) =>
    set((s) => {
      const next = new Set(s.readLessonIds)
      next.add(lessonId)
      return { readLessonIds: next }
    }),
  markScenarioPassed: (scenarioId) =>
    set((s) => {
      const next = new Set(s.passedScenarioIds)
      next.add(scenarioId)
      return { passedScenarioIds: next }
    }),
  markPreTestDone: () => set({ preTestDone: true }),
  markPostTestDone: () => set({ postTestDone: true }),
}))
