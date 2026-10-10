import { ImageResponse } from 'next/og'

export const alt = 'Nightklass — Study smarter. Know exactly what to do next.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '72px', background: 'linear-gradient(135deg, #f8f3ff, #e9d5ff)', color: '#241f2e' }}>
      <div style={{ display: 'flex', color: '#7545cf', fontSize: 30, fontWeight: 700, marginBottom: 48 }}>Nightklass</div>
      <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>Study smarter. Know exactly what to do next.</div>
      <div style={{ display: 'flex', marginTop: 32, fontSize: 28, color: '#61546e' }}>Your AI personal study coach.</div>
      <div style={{ display: 'flex', marginTop: 44, fontSize: 22, color: '#7545cf' }}>nightklass.com</div>
    </div>,
    size,
  )
}
