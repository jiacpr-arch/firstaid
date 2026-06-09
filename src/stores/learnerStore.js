import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Active learner identity (anonymous local profile until enrolled into a cohort).
export const useLearnerStore = create(
  persist(
    (set) => ({
      learner: null, // { id, name, phone?, cohortCode? }
      setLearner: (learner) => set({ learner }),
      updateLearner: (patch) =>
        set((s) => ({ learner: s.learner ? { ...s.learner, ...patch } : null })),
      clear: () => set({ learner: null }),
    }),
    { name: 'firstaid.learner' },
  ),
)
