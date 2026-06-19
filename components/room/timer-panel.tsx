'use client'

import { X, Play, Square } from 'lucide-react'

export function TimerPanel({
  timerMinutes,
  timerSeconds,
  timerRunning,
  autoReset,
  onMinutesChange,
  onSecondsChange,
  onAutoResetToggle,
  onAction,
  onClose,
}: {
  timerMinutes: number
  timerSeconds: number
  timerRunning: boolean
  autoReset: boolean
  onMinutesChange: (v: number) => void
  onSecondsChange: (v: number) => void
  onAutoResetToggle: () => void
  onAction: (action: 'start' | 'stop') => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mx-3 mb-2 rounded-2xl px-4 py-3 space-y-3 shadow-2xl border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', boxShadow: '0 -4px 32px rgba(0,0,0,0.6)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Timer</p>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 flex flex-col items-center gap-1">
          <input
            type="number" min={0} max={59} value={timerMinutes}
            onChange={(e) => onMinutesChange(Math.max(0, Math.min(59, Number(e.target.value))))}
            disabled={timerRunning}
            className="w-full text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-lg py-2 tabular-nums text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40"
          />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Minutes</span>
        </div>
        <span className="text-zinc-500 text-2xl font-bold pb-5">:</span>
        <div className="flex-1 flex flex-col items-center gap-1">
          <input
            type="number" min={0} max={59} value={timerSeconds}
            onChange={(e) => onSecondsChange(Math.max(0, Math.min(59, Number(e.target.value))))}
            disabled={timerRunning}
            className="w-full text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-lg py-2 tabular-nums text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40"
          />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Seconds</span>
        </div>
      </div>
      <label className="flex items-center justify-between cursor-pointer select-none">
        <div>
          <p className="text-xs font-medium text-zinc-300">Time issues</p>
          <p className="text-[10px] text-zinc-500">Restarts automatically after each voting round</p>
        </div>
        <button
          type="button"
          onClick={onAutoResetToggle}
          className={`relative w-10 h-6 rounded-full transition-colors ${autoReset ? 'bg-amber-500' : 'bg-white/10'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoReset ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </label>
      <button
        onClick={() => onAction(timerRunning ? 'stop' : 'start')}
        disabled={!timerRunning && timerMinutes === 0 && timerSeconds === 0}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${timerRunning ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
      >
        {timerRunning ? <><Square className="w-4 h-4 fill-current" /> Stop</> : <><Play className="w-4 h-4 fill-current" /> Start</>}
      </button>
    </div>
  )
}
