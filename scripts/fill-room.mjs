/**
 * Usage:  node scripts/fill-room.mjs <ROOM_CODE> [count] [base_url]
 *
 * Joins a room with fake participants (mix of dev/qa) and casts votes for each.
 * Defaults: count=12, base_url=http://localhost:3000
 *
 * Example:
 *   node scripts/fill-room.mjs ABC123
 *   node scripts/fill-room.mjs ABC123 20
 */

const [roomCode, countArg, baseArg] = process.argv.slice(2)

if (!roomCode) {
  console.error('Usage: node scripts/fill-room.mjs <ROOM_CODE> [count] [base_url]')
  process.exit(1)
}

const COUNT = parseInt(countArg ?? '12', 10)
const BASE = baseArg ?? 'http://localhost:3000'

const NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
  'Grace', 'Heidi', 'Ivan', 'Judy', 'Karl', 'Laura',
  'Mike', 'Nina', 'Oscar', 'Pam', 'Quinn', 'Rob',
  'Sara', 'Tom', 'Uma', 'Vera', 'Will', 'Xena',
  'Yara', 'Zoe',
]

// Alternate dev/qa so we get a balanced split
const TEAMS = ['dev', 'qa']
const ROLES = ['voter', 'voter', 'voter', 'facilitator']

// Fibonacci-style values to make the simulation realistic
const DEV_VOTES  = ['3', '5', '5', '8', '8', '13']
const QA_VOTES   = ['5', '8', '8', '13', '13', '21']

console.log(`Joining room ${roomCode.toUpperCase()} with ${COUNT} fake participants at ${BASE}…\n`)

const participants = []

for (let i = 0; i < COUNT; i++) {
  const name = NAMES[i] ?? `User${i + 1}`
  const team = TEAMS[i % TEAMS.length]
  const role = ROLES[i % ROLES.length]

  const res = await fetch(`${BASE}/api/rooms/${roomCode.toUpperCase()}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, role, team }),
  })

  if (res.ok) {
    const { participantId } = await res.json()
    participants.push({ name, team, role, participantId })
    console.log(`  ✓ joined  ${name.padEnd(8)} role=${role} team=${team}`)
  } else {
    const text = await res.text()
    console.error(`  ✗ ${name}: ${res.status} ${text}`)
  }
}

console.log(`\nCasting votes…\n`)

for (const { name, team, role, participantId } of participants) {
  // Facilitators often skip voting
  if (role === 'facilitator') {
    console.log(`  – skipped ${name.padEnd(8)} (facilitator)`)
    continue
  }

  const pool = team === 'qa' ? QA_VOTES : DEV_VOTES
  const value = pool[Math.floor(Math.random() * pool.length)]

  const res = await fetch(`${BASE}/api/rooms/${roomCode.toUpperCase()}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, value }),
  })

  if (res.ok) {
    console.log(`  ✓ voted   ${name.padEnd(8)} team=${team} value=${value}`)
  } else {
    const text = await res.text()
    console.error(`  ✗ ${name}: ${res.status} ${text}`)
  }
}

console.log('\nDone. Reload the room in your browser to see the layout.')
