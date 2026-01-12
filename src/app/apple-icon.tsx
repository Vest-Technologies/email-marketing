import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 32,
          position: 'relative',
        }}
      >
        <svg
          width="120"
          height="120"
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
            top: 20,
            right: 20,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
    ),
    {
      ...size,
    }
  )
}
