import { phCapture } from '../lib/posthog'

function fbqCustom(event, props) {
  try {
    window.fbq?.('trackCustom', event, props)
  } catch {
    /* tracking must not crash the app */
  }
}

/**
 * Central analytics sink — fans out to Meta Pixel + PostHog.
 * All milestone events in the app should go through here.
 *
 * @param {string} event  snake_case event name
 * @param {object} [props]
 */
export function track(event, props = {}) {
  fbqCustom(event, props)
  phCapture(event, props)
}
