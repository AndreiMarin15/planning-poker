'use client'

import { useState } from 'react'
import React from 'react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
import type { Participant } from '@/lib/types'

export function useEmojiThrow(onThrow: (target: Participant, emoji: string) => void) {
  const [fullPickerTarget, setFullPickerTarget] = useState<Participant | null>(null)
  const [lastEmoji, setLastEmoji] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('pp_last_emoji') : null
  )

  function handleThrowOrPicker(target: Participant, emoji: string) {
    if (emoji === '__picker__') {
      setFullPickerTarget(target)
    } else {
      setLastEmoji(emoji)
      localStorage.setItem('pp_last_emoji', emoji)
      onThrow(target, emoji)
    }
  }

  const EmojiPickerPortal = fullPickerTarget
    ? React.createElement(
        'div',
        {
          className: 'fixed inset-0 z-50 flex items-center justify-center',
          style: { backgroundColor: 'rgba(0,0,0,0.55)' },
          onClick: () => setFullPickerTarget(null),
        },
        React.createElement(
          'div',
          { onClick: (e: React.MouseEvent) => e.stopPropagation() },
          React.createElement(EmojiPicker, {
            theme: Theme.DARK,
            height: 380,
            width: 320,
            onEmojiClick: (data: EmojiClickData) => {
              onThrow(fullPickerTarget, data.emoji)
              setFullPickerTarget(null)
            },
          })
        )
      )
    : null

  return { lastEmoji, fullPickerTarget, setFullPickerTarget, handleThrowOrPicker, EmojiPickerPortal }
}
