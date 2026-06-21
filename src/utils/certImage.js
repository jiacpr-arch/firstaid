import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { toPng } from 'html-to-image'
import CertificateDocument, { CERT_DOC_WIDTH, CERT_DOC_HEIGHT } from '../components/CertificateDocument'

// Renders <CertificateDocument> into a hidden, off-screen (but laid-out) node, waits
// for fonts + the logo image to be ready, runs the callback against the node, then tears
// it all down. The node is positioned far off-screen rather than display:none so text and
// fonts actually measure during capture.
async function withCertNode(args, fn) {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${CERT_DOC_WIDTH}px`,
    height: `${CERT_DOC_HEIGHT}px`,
    pointerEvents: 'none',
  })
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    await new Promise((resolve) => {
      root.render(createElement(CertificateDocument, args))
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
    if (document.fonts?.ready) await document.fonts.ready
    await waitForImages(host)
    return await fn(host.firstElementChild || host)
  } finally {
    root.unmount()
    host.remove()
  }
}

function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'))
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = res
            img.onerror = res
          }),
    ),
  )
}

// Captures the certificate to a PNG data URL at 2x for crisp print/share quality.
export async function certToPng(args) {
  return withCertNode(args, (node) =>
    toPng(node, {
      width: CERT_DOC_WIDTH,
      height: CERT_DOC_HEIGHT,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#FFFFFF',
    }),
  )
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadCertPng(args) {
  const dataUrl = await certToPng(args)
  triggerDownload(dataUrl, `firstaid-${args.kind}-${args.code}.png`)
}
