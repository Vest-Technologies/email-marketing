import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'BrandVox Email Automation'
export const size = {
  width: 1200,
  height: 600,
}
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 20,
              position: 'relative',
            }}
          >
            <svg
              width="52"
              height="52"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="15"
                y="30"
                width="80"
                height="60"
                rx="8"
                stroke="white"
                strokeWidth="6"
                fill="none"
              />
              <path
                d="M20 35L55 62L90 35"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 10L8.5 13.5L15 7"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: 'white',
                letterSpacing: -2,
              }}
            >
              BrandVox
            </span>
            <span
              style={{
                fontSize: 22,
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: -6,
              }}
            >
              Email Automation
            </span>
          </div>
        </div>
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: 700,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          AI-powered B2B email outreach with human-in-the-loop review
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
