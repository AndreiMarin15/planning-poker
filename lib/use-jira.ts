'use client'

import { useState, useEffect, useCallback } from 'react'

export interface JiraIssue {
  key: string
  summary: string
  description: string
  storyPoints: number | null
  status: string | null
  assignee: string | null
  priority: string | null
  url: string
}

export interface JiraSprintIssue {
  key: string
  summary: string
  storyPoints: number | null
  status: string | null
  priority: string | null
  url: string
}

export interface JiraStatus {
  connected: boolean
  cloud_name?: string
  cloud_url?: string
}

export function useJira(roomPath?: string) {
  const [status, setStatus] = useState<JiraStatus | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/jira/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
  }, [])

  const connect = useCallback(() => {
    const returnTo = roomPath ?? window.location.pathname
    window.location.href = `/api/auth/jira?returnTo=${encodeURIComponent(returnTo)}`
  }, [roomPath])

  const disconnect = useCallback(async () => {
    await fetch('/api/auth/jira/disconnect', { method: 'POST' })
    setStatus({ connected: false })
  }, [])

  const fetchIssue = useCallback(async (key: string): Promise<JiraIssue | null> => {
    setLoading(true)
    try {
      const res = await fetch(`/api/jira/issue/${encodeURIComponent(key)}`)
      if (!res.ok) return null
      return await res.json()
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSprint = useCallback(async (project?: string): Promise<JiraSprintIssue[]> => {
    setLoading(true)
    try {
      const url = project ? `/api/jira/sprint?project=${encodeURIComponent(project)}` : '/api/jira/sprint'
      const res = await fetch(url)
      if (!res.ok) return []
      const data = await res.json()
      return data.issues ?? []
    } finally {
      setLoading(false)
    }
  }, [])

  const writeEstimate = useCallback(async (key: string, points: number): Promise<boolean> => {
    const res = await fetch(`/api/jira/issue/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
    return res.ok
  }, [])

  const searchIssues = useCallback(async (q: string): Promise<JiraSprintIssue[]> => {
    if (!q.trim()) return []
    const res = await fetch(`/api/jira/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.issues ?? []
  }, [])

  return { status, loading, connect, disconnect, fetchIssue, fetchSprint, writeEstimate, searchIssues }
}
