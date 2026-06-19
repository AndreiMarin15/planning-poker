'use client'

import { useState } from 'react'
import { THROW_EMOJIS } from '@/lib/types'
import { AvatarImg } from '@/components/avatar'
import { cn } from '@/lib/utils'

export const VOTED_STYLE: React.CSSProperties = {
  backgroundColor: '#2f6fd4',
  backgroundImage: [
    'repeating-linear-gradient(45deg,  rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 9px)',
    'repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 9px)',
  ].join(', '),
}

export type CardSize = 'normal' | 'compact' | 'xs'

export function TableCard({
  pid, name, avatarStyle, voted, revealed, value, isMe, isFacilitator, canThrow, lastEmoji, onThrow, cardSize = 'normal',
}: {
  pid: string; name: string; avatarStyle?: string; voted: boolean; revealed: boolean
  value?: string; isMe: boolean; isFacilitator?: boolean; canThrow: boolean; lastEmoji: string | null
  onThrow?: (emoji: string) => void; cardSize?: CardSize
}) {
  const [hovered, setHovered] = useState(false)
  const cardDims = cardSize === 'xs'
    ? 'w-5 h-7 sm:w-8 sm:h-11 rounded-md sm:rounded-lg'
    : cardSize === 'compact'
    ? 'w-6 h-8 sm:w-9 sm:h-[3rem] rounded-md sm:rounded-xl'
    : 'w-7 h-9 sm:w-11 sm:h-[3.75rem] rounded-lg sm:rounded-xl'
  const nameSize = cardSize === 'xs'
    ? 'text-[7px] sm:text-[9px] max-w-[2.5rem]'
    : cardSize === 'compact'
    ? 'text-[8px] sm:text-[10px] max-w-[3rem]'
    : 'text-[9px] sm:text-[11px] max-w-[3.5rem]'
  const avatarSz = cardSize === 'xs' ? 12 : cardSize === 'compact' ? 15 : 18
  const valueSize = cardSize === 'xs' ? 'text-xs sm:text-base' : cardSize === 'compact' ? 'text-sm sm:text-lg' : 'text-sm sm:text-xl'
  return (
    <div
      data-pid={pid}
      className="relative flex flex-col items-center gap-0.5 sm:gap-1"
      onMouseEnter={() => { if (canThrow) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
    >
      {canThrow && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 flex items-center gap-px px-2 py-1.5 rounded-full z-30 transition-opacity duration-150 whitespace-nowrap"
          style={{
            backgroundColor: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.11)',
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          {THROW_EMOJIS.slice(0, 8).map((e) => (
            <button key={e} onClick={() => onThrow?.(e)}
              className="text-[1rem] leading-none px-0.5 hover:scale-125 active:scale-90 transition-transform cursor-pointer">
              {e}
            </button>
          ))}
          {lastEmoji && !THROW_EMOJIS.slice(0, 8).includes(lastEmoji) && (
            <>
              <span className="w-px h-3.5 bg-white/10 mx-1" />
              <button onClick={() => onThrow?.(lastEmoji)}
                className="text-[1rem] leading-none px-0.5 hover:scale-125 active:scale-90 transition-transform cursor-pointer">
                {lastEmoji}
              </button>
            </>
          )}
          <span className="w-px h-3.5 bg-white/10 mx-1" />
          <button onClick={() => onThrow?.('__picker__')}
            className="text-zinc-500 hover:text-zinc-200 text-[11px] font-semibold px-1 transition-colors">
            ···
          </button>
        </div>
      )}
      {isFacilitator ? (
        <div className={cn(cardDims, 'border border-zinc-700/30 flex items-center justify-center')}
          style={{ backgroundColor: 'rgba(82,82,91,0.15)' }}>
          <span className="text-xs sm:text-base leading-none">👀</span>
        </div>
      ) : (
        <div
          className={cn(
            cardDims, 'border relative overflow-hidden transition-all duration-300',
            !voted && !revealed && 'border-zinc-600/30',
            voted && !revealed && 'border-blue-400/20',
            revealed && 'border-slate-500/30',
          )}
          style={revealed ? { backgroundColor: 'var(--surface2)' } : voted ? VOTED_STYLE : { backgroundColor: 'rgba(82,82,91,0.45)' }}
        >
          {revealed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-white font-bold tabular-nums leading-none', valueSize)}>{value ?? '—'}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col items-center gap-0.5">
        <AvatarImg name={name} style={avatarStyle} size={avatarSz} isMe={isMe} />
        <span className={cn('font-semibold leading-none truncate text-center', nameSize)} style={isMe ? { color: 'var(--accent)' } : { color: '#d4d4d8' }}>
          {name}
        </span>
      </div>
    </div>
  )
}
