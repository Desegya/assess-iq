import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { EmailBrand, renderEmail } from './email-templates'

/** Which product the person is using; decides the sender, links and branding. */
export type ProductApp = 'nightklass' | 'kwikeval'
export const PRODUCT_APPS: ProductApp[] = ['nightklass', 'kwikeval']

export interface OutgoingEmail {
  to: string
  subject: string
  text: string
  html?: string
  app?: ProductApp
}

/**
 * Transactional email through Resend. Without RESEND_API_KEY and a sender address the
 * service refuses to send (callers log the failure); it never pretends delivery succeeded.
 * Senders: EMAIL_FROM (Nightklass, and the fallback) and KWIKEVAL_EMAIL_FROM (KwikEval).
 * Tests replace `deliver` to capture messages.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly client: Resend | null
  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY')
    this.client = key ? new Resend(key) : null
  }

  private sender(app: ProductApp = 'nightklass') {
    const fallback = this.config.get<string>('EMAIL_FROM')
    return app === 'kwikeval' ? this.config.get<string>('KWIKEVAL_EMAIL_FROM') || fallback : fallback
  }

  private kwikevalUrl() {
    return (
      this.config.get<string>('KWIKEVAL_URL') ??
      (process.env.NODE_ENV === 'production' ? 'https://www.kwikeval.com' : 'http://localhost:3000')
    )
  }

  private brand(app: ProductApp): EmailBrand {
    if (app === 'kwikeval') {
      return { name: 'KwikEval', wordmark: ['Kwik', 'Eval'], siteUrl: this.kwikevalUrl(), tagline: 'Quick, fair tests for your class' }
    }
    const reset = new URL(this.config.get<string>('PASSWORD_RESET_URL', 'http://localhost:3002/reset-password'))
    return { name: 'Nightklass', wordmark: ['Night', 'klass'], siteUrl: reset.origin, tagline: 'Your personal study coach' }
  }

  private link(app: ProductApp, path: 'reset-password' | 'verify-email', token: string) {
    const url =
      app === 'kwikeval'
        ? new URL(path, this.kwikevalUrl())
        : (() => {
            const u = new URL(this.config.get<string>('PASSWORD_RESET_URL', 'http://localhost:3002/reset-password'))
            u.pathname = u.pathname.replace(/[^/]*$/, path)
            return u
          })()
    // Tokens travel in the URL fragment so they are not sent to servers or written to access logs.
    url.hash = `token=${encodeURIComponent(token)}`
    return url.toString()
  }

  async deliver(message: OutgoingEmail) {
    const from = this.sender(message.app)
    if ((!this.client || !from) && process.env.NODE_ENV !== 'production') {
      // Local development without an email provider: print the message so links can be followed.
      this.logger.warn(`[dev email] to=${message.to} subject="${message.subject}"\n${message.text}`)
      return
    }
    if (!this.client || !from) throw new ServiceUnavailableException('Email delivery is not configured')
    const { error } = await this.client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    })
    if (error) throw new Error(`Email provider rejected the message: ${error.name}`)
  }

  sendPasswordReset(to: string, name: string, token: string, app: ProductApp = 'nightklass') {
    const brand = this.brand(app)
    const { html, text } = renderEmail(brand, {
      preview: `Choose a new ${brand.name} password. The link works once, for 30 minutes.`,
      heading: 'Reset your password',
      greeting: `Hi ${name},`,
      paragraphs: [`We received a request to reset the password for your ${brand.name} account.`],
      button: { label: 'Choose a new password', url: this.link(app, 'reset-password', token) },
      note: 'This link works once and expires in 30 minutes. Resetting signs you out on every device.',
      footer: 'If you did not ask for this, you can ignore this email; your password will not change.',
    })
    return this.deliver({ to, app, subject: `Reset your ${brand.name} password`, text, html })
  }

  sendEmailVerification(to: string, name: string, token: string, app: ProductApp = 'nightklass') {
    const brand = this.brand(app)
    const { html, text } = renderEmail(brand, {
      preview:
        app === 'kwikeval'
          ? 'One tap to confirm your email and join your class.'
          : 'Confirm your email so you can recover your account.',
      heading: 'Confirm your email',
      greeting: `Hi ${name},`,
      paragraphs:
        app === 'kwikeval'
          ? [
              'Welcome to KwikEval. Confirm this is your email address so you can join your classes.',
              'Most lecturers only let in students with a confirmed school email.',
            ]
          : ['Welcome to Nightklass. Confirm this email address so you can recover your account if you forget your password.'],
      button: { label: 'Confirm my email', url: this.link(app, 'verify-email', token) },
      note: 'This link expires in 48 hours.',
      footer: `You are receiving this because this address was used to sign up for ${brand.name}. If that wasn't you, ignore this email.`,
    })
    return this.deliver({ to, app, subject: `Confirm your ${brand.name} email`, text, html })
  }
}
