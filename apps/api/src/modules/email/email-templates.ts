/**
 * Transactional email layout shared by Nightklass and KwikEval: an HTML version
 * (table layout and inline styles so Gmail, Outlook and phone mail apps agree) and a
 * plain-text version. The action link is always the first URL in the text version.
 */

export interface EmailBrand {
  name: string
  /** Wordmark split for the two-tone logo, e.g. ['Kwik', 'Eval'] */
  wordmark: [string, string]
  siteUrl: string
  tagline: string
}

export interface EmailContent {
  /** Shown in the inbox list next to the subject */
  preview: string
  heading: string
  greeting: string
  paragraphs: string[]
  button: { label: string; url: string }
  /** Small print under the button, e.g. when the link expires */
  note: string
  /** Why the person received this, and what to do if it wasn't them */
  footer: string
}

const PURPLE = '#7545cf'
const INK = '#241f2e'
const MUTED = '#716778'
const BORDER = '#eae6ef'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function renderEmail(brand: EmailBrand, c: EmailContent): { html: string; text: string } {
  const url = escapeHtml(c.button.url)
  const paragraphs = c.paragraphs
    .map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK};">${escapeHtml(p)}</p>`)
    .join('')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f2ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(c.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ff;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${INK};">
        ${escapeHtml(brand.wordmark[0])}<span style="color:${PURPLE};">${escapeHtml(brand.wordmark[1])}</span>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:20px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:30px;font-weight:bold;color:${INK};">${escapeHtml(c.heading)}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK};">${escapeHtml(c.greeting)}</p>
        ${paragraphs}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
          <tr><td style="border-radius:14px;background:${PURPLE};">
            <a href="${url}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:14px;">${escapeHtml(c.button.label)}</a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(c.note)}</p>
        <p style="margin:0;font-size:13px;line-height:20px;color:${MUTED};">If the button doesn&rsquo;t work, copy this link into your browser:<br>
          <a href="${url}" style="color:${PURPLE};word-break:break-all;">${url}</a></p>
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">
        ${escapeHtml(c.footer)}<br><br>
        ${escapeHtml(brand.name)} · ${escapeHtml(brand.tagline)} · <a href="${escapeHtml(brand.siteUrl)}" style="color:${MUTED};">${escapeHtml(brand.siteUrl.replace(/^https?:\/\//, ''))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    c.greeting,
    '',
    ...c.paragraphs.flatMap(p => [p, '']),
    `${c.button.label}: ${c.button.url}`,
    '',
    c.note,
    '',
    c.footer,
    '',
    `${brand.name} · ${brand.siteUrl}`,
  ].join('\n')

  return { html, text }
}
