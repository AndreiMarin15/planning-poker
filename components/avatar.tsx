'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export const AVATAR_STYLES = [
  { id: 'bottts',       label: 'Robot'    },
  { id: 'fun-emoji',    label: 'Emoji'    },
  { id: 'lorelei',      label: 'Explorer' },
  { id: 'pixel-art',    label: 'Pixel'    },
  { id: 'adventurer',   label: 'Hero'     },
  { id: 'thumbs',       label: 'Thumbs'   },
] as const

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]['id']
export const DEFAULT_AVATAR: AvatarStyleId = 'bottts'

export function avatarUrl(name: string, style: string = DEFAULT_AVATAR): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(name || 'anon')}`
}

// ── Avatar image ─────────────────────────────────────────────────────────────

interface AvatarImgProps {
  name: string
  style?: string
  size?: number
  isMe?: boolean
  className?: string
}

export function AvatarImg({ name, style, size = 32, isMe = false, className }: AvatarImgProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl(name, style)}
      alt={name}
      width={size}
      height={size}
      className={cn(
        'rounded-full shrink-0 object-cover',
        isMe && 'ring-2 ring-violet-500 ring-offset-1 ring-offset-[#0f1929]',
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}

// ── Style picker ─────────────────────────────────────────────────────────────

interface AvatarPickerProps {
  name: string
  value: string
  onChange: (style: AvatarStyleId) => void
}

export function AvatarPicker({ name, value, onChange }: AvatarPickerProps) {
  // Debounce the name so thumbnails don't flicker on every keystroke,
  // but each option still accurately shows YOUR avatar in that style.
  const [seed, setSeed] = useState(name.trim() || 'anon')
  useEffect(() => {
    const t = setTimeout(() => setSeed(name.trim() || 'anon'), 400)
    return () => clearTimeout(t)
  }, [name])

  return (
    <div className="flex gap-2 flex-wrap">
      {AVATAR_STYLES.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.label}
          onClick={() => onChange(s.id)}
          className={cn(
            'rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
            value === s.id
              ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#172035] scale-110'
              : 'opacity-50 hover:opacity-90 hover:scale-105',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl(seed, s.id)}
            alt={s.label}
            width={38}
            height={38}
            className="rounded-full"
          />
        </button>
      ))}
    </div>
  )
}
