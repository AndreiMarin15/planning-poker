'use client'

import { cn } from '@/lib/utils'

interface PokerCardProps {
  value: string
  selected?: boolean
  revealed?: boolean
  onClick?: () => void
  disabled?: boolean
}

export function PokerCard({ value, selected, revealed, onClick, disabled }: PokerCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative w-[3.75rem] h-[5.25rem] rounded-2xl flex flex-col items-center justify-center',
        'border-2 font-bold select-none transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
        selected
          ? 'bg-violet-600 border-violet-400/80 text-white shadow-[0_0_24px_rgba(124,58,237,0.55)] scale-[1.1] -translate-y-2'
          : revealed
          ? 'bg-[#1a2e4a]/80 border-white/10 text-white cursor-default'
          : 'bg-transparent border-zinc-600/70 text-zinc-300 hover:border-violet-400/60 hover:text-white hover:scale-[1.07] hover:-translate-y-1.5 hover:shadow-[0_4px_18px_rgba(124,58,237,0.3)] cursor-pointer',
        disabled && !selected && 'opacity-40 pointer-events-none'
      )}
    >
      <span className="absolute top-1.5 left-2 text-[9px] font-semibold opacity-40 leading-none tabular-nums">
        {value}
      </span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="absolute bottom-1.5 right-2 text-[9px] font-semibold opacity-40 leading-none rotate-180 tabular-nums">
        {value}
      </span>
    </button>
  )
}
