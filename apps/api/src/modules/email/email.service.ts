import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

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

  private link(path: 'reset-password' | 'verify-email', token: string) {
    const base = this.config.get<string>('PASSWORD_RESET_URL', 'http://localhost:3002/reset-password')
    const url = new URL(base)
    url.pathname = url.pathname.replace(/[^/]*$/, path)
    url.hash = `token=${encodeURIComponent(token)}`
    return url.toString()
  }

  async deliver(message: OutgoingEmail) {
    const from = this.config.get<string>('EMAIL_FROM')
    if (!this.client || !from) throw new ServiceUnavailableException('Email delivery is not configured')
    const { error } = await this.client.emails.send({ from, ...message })
    if (error) throw new Error(`Email provider rejected the message: ${error.name}`)
  }

  // Tokens travel in the URL fragment so they are not sent to servers or written to access logs.
  sendPasswordReset(to: string, name: string, token: string) {
    return this.deliver({
      to,
      subject: 'Reset your Nightklass password',
      text: `Hi ${name},\n\nUse this link within 30 minutes to choose a new password:\n${this.link('reset-password', token)}\n\nIf you did not ask for this, you can ignore this email; your password will not change.\n\nNightklass`,
    })
  }

  sendEmailVerification(to: string, name: string, token: string) {
    return this.deliver({
      to,
      subject: 'Confirm your Nightklass email',
      text: `Hi ${name},\n\nConfirm this email address so you can recover your account if you forget your password:\n${this.link('verify-email', token)}\n\nThe link expires in 48 hours.\n\nNightklass`,
    })
  }
}
