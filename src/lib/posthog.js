import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialised = false

export function initPostHog() {
  if (!KEY || initialised) return
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
  })
  initialised = true
}

export function identifyLearner({ learnerId, lineUserId, displayName } = {}) {
  if (!KEY || !initialised) return
  if (learnerId) {
    posthog.identify(learnerId, {
      ...(lineUserId ? { lineUserId } : {}),
      ...(displayName ? { displayName } : {}),
    })
  }
}

export function phCapture(event, props) {
  if (!KEY || !initialised) return
  posthog.capture(event, props)
}
