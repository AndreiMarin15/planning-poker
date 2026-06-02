'use client'

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
  // Style thumbnails use a fixed seed so they stay stable while the user types.
  // A separate live preview shows what THEIR avatar actually looks like.
  const liveSeed = name.trim() || 'anon'
  return (
    <div className="flex items-center gap-4">
      {/* Fixed-seed style options */}
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
                : 'opacity-40 hover:opacity-80 hover:scale-105',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(s.id, s.id)} // seed = style id → each style always shows the same character
              alt={s.label}
              width={36}
              height={36}
              className="rounded-full"
            />
          </button>
        ))}
      </div>

      {/* Live "your avatar" preview — updates as the name changes */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(liveSeed, value)}
          alt="your avatar"
          width={44}
          height={44}
          className="rounded-full ring-2 ring-violet-500 ring-offset-2 ring-offset-[#172035]"
        />
        <span className="text-[10px] text-zinc-600">you</span>
      </div>
    </div>
  )
}
