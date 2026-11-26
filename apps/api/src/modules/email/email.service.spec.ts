import { describe, expect, it, vi } from 'vitest'
import { EmailService } from './email.service'

function service(env: Record<string, string | undefined>) {
  const config = { get: (key: string, fallback?: string) => env[key] ?? fallback }
  const svc = new EmailService(config as never)
  const send = vi.fn().mockResolvedValue({ error: null })
  ;(svc as unknown as { client: unknown }).client = { emails: { send } }
  return { svc, send }
}
const base = {
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'Nightklass <no-reply@nightklass.com>',
  KWIKEVAL_EMAIL_FROM: 'KwikEval <no-reply@kwikeval.com>',
  KWIKEVAL_URL: 'https://www.kwikeval.com',
  PASSWORD_RESET_URL: 'https://nightklass.com/reset-password',
}

describe('EmailService', () => {
  it('sends KwikEval mail from the KwikEval sender with a KwikEval link', async () => {
    const { svc, send } = service(base)
    await svc.sendEmailVerification('kofi@st.ug.edu.gh', 'Kofi', 'tok123', 'kwikeval')
    const msg = send.mock.calls[0]![0]
    expect(msg.from).toBe('KwikEval <no-reply@kwikeval.com>')
    expect(msg.subject).toBe('Confirm your KwikEval email')
    expect(msg.html).toContain('href="https://www.kwikeval.com/verify-email#token=tok123"')
    expect(msg.text.match(/https:\S+/)![0]).toBe('https://www.kwikeval.com/verify-email#token=tok123')
  })

  it('sends Nightklass mail from EMAIL_FROM, and KwikEval falls back to it', async () => {
    const { svc, send } = service(base)
    await svc.sendPasswordReset('a@b.test', 'Ama', 'tok', 'nightklass')
    expect(send.mock.calls[0]![0].from).toBe('Nightklass <no-reply@nightklass.com>')
    expect(send.mock.calls[0]![0].text.match(/https:\S+/)![0]).toBe('https://nightklass.com/reset-password#token=tok')

    const fallback = service({ ...base, KWIKEVAL_EMAIL_FROM: undefined })
    await fallback.svc.sendPasswordReset('a@b.test', 'Ama', 'tok', 'kwikeval')
    expect(fallback.send.mock.calls[0]![0].from).toBe('Nightklass <no-reply@nightklass.com>')
  })

  it('escapes names in the HTML version', async () => {
    const { svc, send } = service(base)
    await svc.sendEmailVerification('a@b.test', '<script>alert(1)</script>', 'tok', 'kwikeval')
    const { html } = send.mock.calls[0]![0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('refuses to send in production without a sender', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const { svc, send } = service({ ...base, EMAIL_FROM: undefined, KWIKEVAL_EMAIL_FROM: undefined })
      await expect(svc.sendPasswordReset('a@b.test', 'Ama', 'tok')).rejects.toThrow(/not configured/)
      expect(send).not.toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = prev
    }
  })
})
