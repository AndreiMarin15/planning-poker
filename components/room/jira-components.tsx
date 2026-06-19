'use client'

import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*\n]+\*)/)
  return parts.map((p, i) =>
    p.startsWith('*') && p.endsWith('*')
      ? <strong key={i} className="text-zinc-300 font-semibold">{p.slice(1, -1)}</strong>
      : p
  )
}

export function JiraText({ text }: { text: string }) {
  const cleaned = text.replace(/![^!\n]+!/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned) return null

  const lines = cleaned.split('\n')
  const nodes: React.ReactNode[] = []
  let olItems: React.ReactNode[] = []
  let ulItems: React.ReactNode[] = []

  const flushOl = () => {
    if (olItems.length) {
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="list-decimal list-outside ml-4 space-y-0.5">
          {olItems}
        </ol>
      )
      olItems = []
    }
  }
  const flushUl = () => {
    if (ulItems.length) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="list-disc list-outside ml-4 space-y-0.5">
          {ulItems}
        </ul>
      )
      ulItems = []
    }
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (/^#+\s/.test(line)) {
      flushUl()
      olItems.push(<li key={i} className="text-[11px] text-zinc-400 leading-relaxed">{renderInline(line.replace(/^#+\s/, ''))}</li>)
    } else if (/^-\s/.test(line) || /^\*\s/.test(line)) {
      flushOl()
      ulItems.push(<li key={i} className="text-[11px] text-zinc-400 leading-relaxed">{renderInline(line.replace(/^[-*]\s/, ''))}</li>)
    } else if (/^h[1-6]\.\s/.test(line)) {
      flushOl(); flushUl()
      nodes.push(<p key={i} className="text-xs font-semibold text-zinc-300 mt-1">{renderInline(line.replace(/^h[1-6]\.\s/, ''))}</p>)
    } else if (!line.trim()) {
      flushOl(); flushUl()
    } else {
      flushOl(); flushUl()
      nodes.push(<p key={i} className="text-[11px] text-zinc-400 leading-relaxed">{renderInline(line)}</p>)
    }
  })
  flushOl(); flushUl()

  return <div className="space-y-1">{nodes}</div>
}

export function JiraBadge({ ticket, link }: { ticket: string; link?: string }) {
  const cls = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono text-blue-300 bg-blue-500/15 border border-blue-500/20 shrink-0'
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        className={cn(cls, 'hover:bg-blue-500/25 hover:text-blue-200 transition-colors')}>
        {ticket}
        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
      </a>
    )
  }
  return <span className={cls}>{ticket}</span>
}
