// Extracts a Jira ticket key from either a bare key ("SP-101") or a full URL.
// Returns null if no ticket pattern is found.
export function extractJiraTicket(input: string): string | null {
  const trimmed = input.trim()
  // Full Jira URL: .../browse/SP-101 or .../jira/...?selectedIssue=SP-101
  const browseMatch = trimmed.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i)
  if (browseMatch) return browseMatch[1].toUpperCase()
  const queryMatch = trimmed.match(/[?&](?:selectedIssue|issue)=([A-Z][A-Z0-9_]+-\d+)/i)
  if (queryMatch) return queryMatch[1].toUpperCase()
  // Bare ticket key
  const bareMatch = trimmed.match(/^([A-Z][A-Z0-9_]+-\d+)$/i)
  if (bareMatch) return bareMatch[1].toUpperCase()
  return null
}

export function isJiraUrl(input: string): boolean {
  try {
    const url = new URL(input.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
