// Remembers which class link a student was following while they sign up or confirm
// their email, so they land back on it afterwards (even from the email link, same device).
const KEY = 'kwikeval:pendingJoin'

export function rememberJoinCode(code: string) {
  try { localStorage.setItem(KEY, code) } catch { /* private mode */ }
}
export function pendingJoinCode(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export function forgetJoinCode() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
}
