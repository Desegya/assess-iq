/** Must match PRIVACY_NOTICE_VERSION in apps/api/src/modules/auth/dto/register-student.dto.ts. */
export const PRIVACY_NOTICE_VERSION = '2026-10-23'

/** Set NEXT_PUBLIC_SUPPORT_EMAIL before launch; the notice states plainly when it is missing. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? ''
