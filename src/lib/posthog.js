import posthog from 'posthog-js'
import { isAutomated } from './isAutomated'
import { checkoutAnalyticsBlocked, filterCheckoutAnalyticsEvent } from './checkoutAnalyticsBoundary.js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialised = false

export function initPostHog() {
  // ไม่ init ใน browser อัตโนมัติ (prerender ตอน build) — กัน pageview ปลอม
  if (isAutomated || !KEY || initialised || checkoutAnalyticsBlocked(window.location, document.referrer)) return
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    capture_performance: false,
    disable_session_recording: true,
    before_send: event => filterCheckoutAnalyticsEvent(event, window.location, document.referrer),
  })
  initialised = true
}

export function identifyLearner({ learnerId, lineUserId, displayName } = {}) {
  if (!KEY || !initialised || checkoutAnalyticsBlocked(window.location, document.referrer)) return
  if (learnerId) {
    posthog.identify(learnerId, {
      ...(lineUserId ? { lineUserId } : {}),
      ...(displayName ? { displayName } : {}),
    })
  }
}

export function phCapture(event, props) {
  if (!KEY || !initialised || checkoutAnalyticsBlocked(window.location, document.referrer)) return
  posthog.capture(event, props)
}
