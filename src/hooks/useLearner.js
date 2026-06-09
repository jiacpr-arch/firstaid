import { useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner } from '../db/database'

// Ensures we have an anonymous local learner id even before the user enters their name.
export function useEnsureLearner() {
  const learner = useLearnerStore((s) => s.learner)
  const setLearner = useLearnerStore((s) => s.setLearner)

  useEffect(() => {
    if (!learner) {
      const id = uuidv4()
      const fresh = { id, name: '', createdAt: new Date().toISOString() }
      setLearner(fresh)
      upsertLearner(fresh)
    }
  }, [learner, setLearner])

  return learner
}
