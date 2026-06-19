'use client'

import type { ParticipantTeam } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AvatarPicker, type AvatarStyleId } from '@/components/avatar'
import { cn } from '@/lib/utils'

export function JoinDialog({
  open,
  roomName,
  joinName, setJoinName,
  joinAvatar, setJoinAvatar,
  joinRole, setJoinRole,
  joinTeam, setJoinTeam,
  joining,
  onJoin,
}: {
  open: boolean
  roomName?: string
  joinName: string; setJoinName: (v: string) => void
  joinAvatar: AvatarStyleId; setJoinAvatar: (v: AvatarStyleId) => void
  joinRole: 'voter' | 'facilitator'; setJoinRole: (v: 'voter' | 'facilitator') => void
  joinTeam: ParticipantTeam | undefined; setJoinTeam: (v: ParticipantTeam | undefined) => void
  joining: boolean
  onJoin: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border text-zinc-100 sm:max-w-sm"
        style={{ backgroundColor: 'var(--surface2)', borderColor: 'var(--border)' }}>
        <DialogHeader>
          <DialogTitle className="text-zinc-100 text-base">
            {roomName ? `Join "${roomName}"` : 'Join Room'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Enter your name to join the session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your name</Label>
            <Input placeholder="e.g. Alice" value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              className="h-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
              autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Avatar <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
            </Label>
            <AvatarPicker name={joinName} value={joinAvatar} onChange={setJoinAvatar} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Role</Label>
            <div className="flex gap-2">
              {(['voter', 'facilitator'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setJoinRole(r)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors',
                    joinRole === r
                      ? 'border-white/70 bg-white/10 text-white'
                      : 'border-zinc-700/50 bg-white/[0.03] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
                  )}
                >
                  <span className="text-base">{r === 'voter' ? '🗳️' : '👀'}</span>
                  <span className="capitalize">{r}</span>
                  <span className="text-[10px] font-normal text-zinc-600 normal-case">
                    {r === 'voter' ? 'Votes on stories' : 'Observes, no vote'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Team <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
            </Label>
            <div className="flex gap-2">
              {([
                { id: 'dev' as const, label: 'Developer', emoji: '💻', desc: 'Dev estimate' },
                { id: 'qa' as const, label: 'QA', emoji: '🧪', desc: 'QA estimate' },
              ]).map(({ id, label, emoji, desc }) => (
                <button
                  key={id}
                  onClick={() => setJoinTeam(joinTeam === id ? undefined : id)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors',
                    joinTeam === id
                      ? 'border-white/70 bg-white/10 text-white'
                      : 'border-zinc-700/50 bg-white/[0.03] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
                  )}
                >
                  <span className="text-base">{emoji}</span>
                  <span>{label}</span>
                  <span className="text-[10px] font-normal text-zinc-600 normal-case">{desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-700 text-center">Used to compute separate Dev + QA averages</p>
          </div>
          <Button onClick={onJoin} disabled={!joinName.trim() || joining}
            className="w-full text-white h-10 text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent)' }}>
            {joining ? 'Joining...' : 'Join Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
