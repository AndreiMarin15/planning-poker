'use client'

import { useState, useEffect } from 'react'

export const THEMES = [
  { id: 'teal',   label: 'Teal',   accent: '#14b8a6', hover: '#0d9488', muted: 'rgba(20,184,166,0.12)',  ring: 'rgba(20,184,166,0.35)' },
  { id: 'violet', label: 'Violet', accent: '#8b5cf6', hover: '#7c3aed', muted: 'rgba(139,92,246,0.12)', ring: 'rgba(139,92,246,0.35)' },
  { id: 'blue',   label: 'Blue',   accent: '#3b82f6', hover: '#2563eb', muted: 'rgba(59,130,246,0.12)',  ring: 'rgba(59,130,246,0.35)' },
  { id: 'green',  label: 'Green',  accent: '#10b981', hover: '#059669', muted: 'rgba(16,185,129,0.12)',  ring: 'rgba(16,185,129,0.35)' },
  { id: 'rose',   label: 'Rose',   accent: '#f43f5e', hover: '#e11d48', muted: 'rgba(244,63,94,0.12)',   ring: 'rgba(244,63,94,0.35)'  },
  { id: 'amber',  label: 'Amber',  accent: '#f59e0b', hover: '#d97706', muted: 'rgba(245,158,11,0.12)',  ring: 'rgba(245,158,11,0.35)' },
] as const

export type ThemeId = typeof THEMES[number]['id']
export type Theme = typeof THEMES[number]

const STORAGE_KEY = 'pp_theme'

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function useTheme() {
  const [themeId, setThemeId] = useState<ThemeId>('teal')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (stored && THEMES.some((t) => t.id === stored)) setThemeId(stored)
  }, [])

  function setTheme(id: ThemeId) {
    setThemeId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return { themeId, theme: getTheme(themeId), setTheme, themes: THEMES, mounted }
}
