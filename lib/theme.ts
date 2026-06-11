'use client'

import { useState, useEffect } from 'react'

export const THEMES = [
  {
    id: 'teal', label: 'Teal', light: false,
    accent: '#14b8a6', hover: '#0d9488', muted: 'rgba(20,184,166,0.12)', ring: 'rgba(20,184,166,0.35)',
    bg: '#08141a', surface: '#0d1e24', surface2: '#112530', border: 'rgba(20,184,166,0.12)',
  },
  {
    id: 'violet', label: 'Violet', light: false,
    accent: '#8b5cf6', hover: '#7c3aed', muted: 'rgba(139,92,246,0.12)', ring: 'rgba(139,92,246,0.35)',
    bg: '#0e0b1a', surface: '#150f27', surface2: '#1c1535', border: 'rgba(139,92,246,0.12)',
  },
  {
    id: 'blue', label: 'Blue', light: false,
    accent: '#3b82f6', hover: '#2563eb', muted: 'rgba(59,130,246,0.12)', ring: 'rgba(59,130,246,0.35)',
    bg: '#090f1a', surface: '#0f1929', surface2: '#132035', border: 'rgba(59,130,246,0.12)',
  },
  {
    id: 'green', label: 'Green', light: false,
    accent: '#10b981', hover: '#059669', muted: 'rgba(16,185,129,0.12)', ring: 'rgba(16,185,129,0.35)',
    bg: '#081510', surface: '#0d2018', surface2: '#112a1f', border: 'rgba(16,185,129,0.12)',
  },
  {
    id: 'rose', label: 'Rose', light: false,
    accent: '#f43f5e', hover: '#e11d48', muted: 'rgba(244,63,94,0.12)', ring: 'rgba(244,63,94,0.35)',
    bg: '#180a0d', surface: '#240f14', surface2: '#2e141a', border: 'rgba(244,63,94,0.12)',
  },
  {
    id: 'amber', label: 'Amber', light: false,
    accent: '#f59e0b', hover: '#d97706', muted: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.35)',
    bg: '#150f04', surface: '#1f1608', surface2: '#281d0b', border: 'rgba(245,158,11,0.12)',
  },
  {
    id: 'dark', label: 'Dark', light: false,
    accent: '#a1a1aa', hover: '#71717a', muted: 'rgba(161,161,170,0.12)', ring: 'rgba(161,161,170,0.3)',
    bg: '#090909', surface: '#111111', surface2: '#1a1a1a', border: 'rgba(255,255,255,0.07)',
  },
  {
    id: 'white', label: 'White', light: true,
    accent: '#2563eb', hover: '#1d4ed8', muted: 'rgba(37,99,235,0.08)', ring: 'rgba(37,99,235,0.3)',
    bg: '#ede8e0', surface: '#e8e2d9', surface2: '#dfd8ce', border: 'rgba(0,0,0,0.08)',
  },
] as const

export type ThemeId = typeof THEMES[number]['id']
export type Theme = typeof THEMES[number]

const STORAGE_KEY = 'pp_theme'

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function useTheme() {
  const [themeId, setThemeId] = useState<ThemeId>('dark')
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
