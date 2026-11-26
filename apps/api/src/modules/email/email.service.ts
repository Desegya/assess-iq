import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

/** Which product the person is using; decides the link and the name in the email. */
export type ProductApp = 'nightklass' | 'kwikeval'
export const PRODUCT_APPS: ProductApp[] = ['nightklass', 'kwikeval']

const BRAND: Record<ProductApp, string> = { nightklass: 'Nightklass', kwikeval: 'KwikEval' }

export interface OutgoingEmail {
  to: string
  subject: string
  text: string
}

/**
 * Transactional email through Resend. Without RESEND_API_KEY/EMAIL_FROM the
 * service refuses to send (callers log the failure); it never pretends delivery
 * succeeded. Tests replace `deliver` to capture messages.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly client: Resend | null
  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY')
    this.client = key ? new Resend(key) : null
  }

  private link(app: ProductApp, path: 'reset-password' | 'verify-email', token: string) {
    const url =
      app === 'kwikeval'
        ? new URL(
            path,
            this.config.get<string>('KWIKEVAL_URL') ??
              (process.env.NODE_ENV === 'production' ? 'https://www.kwikeval.com' : 'http://localhost:3000'),
          )
        : (() => {
            const u = new URL(this.config.get<string>('PASSWORD_RESET_URL', 'http://localhost:3002/reset-password'))
            u.pathname = u.pathname.replace(/[^/]*$/, path)
            return u
          })()
    url.hash = `token=${encodeURIComponent(token)}`
    return url.toString()
  }

  async deliver(message: OutgoingEmail) {
    const from = this.config.get<string>('EMAIL_FROM')
    if ((!this.client || !from) && process.env.NODE_ENV !== 'production') {
      // Local development without an email provider: print the message so links can be followed.
      this.logger.warn(`[dev email] to=${message.to} subject="${message.subject}"\n${message.text}`)
      return
    }
    if (!this.client || !from) throw new ServiceUnavailableException('Email delivery is not configured')
    const { error } = await this.client.emails.send({ from, ...message })
    if (error) throw new Error(`Email provider rejected the message: ${error.name}`)
  }

  // Tokens travel in the URL fragment so they are not sent to servers or written to access logs.
  sendPasswordReset(to: string, name: string, token: string, app: ProductApp = 'nightklass') {
    const brand = BRAND[app]
    return this.deliver({
      to,
      subject: `Reset your ${brand} password`,
      text: `Hi ${name},\n\nUse this link within 30 minutes to choose a new password:\n${this.link(app, 'reset-password', token)}\n\nIf you did not ask for this, you can ignore this email; your password will not change.\n\n${brand}`,
    })
  }

  sendEmailVerification(to: string, name: string, token: string, app: ProductApp = 'nightklass') {
    const brand = BRAND[app]
    const why =
      app === 'kwikeval'
        ? 'Confirm this email address so you can join your classes and recover your account if you forget your password'
        : 'Confirm this email address so you can recover your account if you forget your password'
    return this.deliver({
      to,
      subject: `Confirm your ${brand} email`,
      text: `Hi ${name},\n\n${why}:\n${this.link(app, 'verify-email', token)}\n\nThe link expires in 48 hours.\n\n${brand}`,
    })
  }
}
