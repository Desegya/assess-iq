import { MathText } from './MathText'

/** Preserve source wording and line breaks; change only its presentation. */
export function ReadingText({ children }: { children: string }) {
  return (
    <div className="reading-text whitespace-pre-wrap">
      <MathText>{children}</MathText>
    </div>
  )
}
