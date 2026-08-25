import { ImageResponse } from 'next/og'

// Carte OpenGraph/Twitter par défaut du site (générée au build).
export const alt = "Factur-IA — La facturation qui s'écrit toute seule"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0a',
          color: '#fafafa',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 30,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#a3a3a3',
          }}
        >
          Conforme 2026 · Gratuit · Open source
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            La facturation qui s'écrit toute seule.
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: '#d4d4d4', lineHeight: 1.35 }}>
            Décrivez votre prestation en une phrase — la facture conforme part toute seule.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 32,
          }}
        >
          <div style={{ display: 'flex', fontWeight: 700, fontSize: 40 }}>Factur-IA</div>
          <div style={{ display: 'flex', color: '#a3a3a3' }}>facturation.quatools.fr</div>
        </div>
      </div>
    ),
    size
  )
}
