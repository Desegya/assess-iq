export type JoinPolicy = 'EMAIL_DOMAIN' | 'EMAIL_LIST' | 'APPROVAL' | 'OPEN_LINK'

export const POLICY_OPTIONS: { value: JoinPolicy; label: string; help: string }[] = [
  {
    value: 'EMAIL_DOMAIN',
    label: 'School email only',
    help: 'Students join with a confirmed school email, for example @ug.edu.gh. Recommended.',
  },
  { value: 'EMAIL_LIST', label: 'Only emails on my list', help: 'You paste the student emails; only those can join.' },
  { value: 'APPROVAL', label: 'I approve each student', help: 'Anyone with the link can ask; you let them in.' },
  { value: 'OPEN_LINK', label: 'Anyone with the link', help: 'No checks. Use only for informal practice.' },
]

/** Mirrors FREE_MAIL_DOMAINS in the API: a personal mailbox says nothing about the school. */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'mail.com', 'gmx.com',
])

export function schoolDomainOf(email: string | undefined): string {
  const domain = email?.trim().toLowerCase().split('@')[1] ?? ''
  return domain && !FREE_MAIL.has(domain) ? domain : ''
}

export function classLink(code: string) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/join/${code}`
}

/** Split pasted text (commas, spaces, new lines, CSV columns) into unique emails. */
export function parseEmails(text: string): { emails: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map(p => p.trim().replace(/^<|>$/g, '')).filter(Boolean)
  const emails = new Set<string>()
  const invalid: string[] = []
  for (const part of parts) {
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part)) emails.add(part.toLowerCase())
    else if (part.includes('@')) invalid.push(part)
  }
  return { emails: [...emails], invalid }
}
