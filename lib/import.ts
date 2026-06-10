export interface DraftTopic {
  id: string
  jiraTicket: string
  jiraLink: string
  title: string
  description: string
}

export async function parseImportFile(file: File): Promise<DraftTopic[]> {
  const { read, utils } = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  return rows
    .map((row) => {
      const title = (row['Summary'] || row['summary'] || row['Title'] || row['title'] || '').trim()
      const ticket = (row['Issue key'] || row['issue key'] || row['Key'] || row['key'] || row['Ticket'] || row['ticket'] || '').trim().toUpperCase()
      const link = (row['URL'] || row['url'] || row['Link'] || row['link'] || '').trim()
      const description = (row['Description'] || row['description'] || '').trim().replace(/![^!\n]+!/g, '').replace(/\n{3,}/g, '\n\n').trim()
      return { id: crypto.randomUUID(), title, jiraTicket: ticket, jiraLink: link, description }
    })
    .filter((t) => t.title)
}
