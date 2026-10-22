import type { Metadata } from 'next'
import Link from 'next/link'
import { PRIVACY_NOTICE_VERSION, SUPPORT_EMAIL } from '@/lib/privacy'

export const metadata: Metadata = { title: 'Privacy notice' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const contact = SUPPORT_EMAIL ? (
    <a className="text-violet-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <strong>the support contact shown in the app (being set up)</strong>
  )
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-violet-700">
          ← Nightklass
        </Link>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Privacy notice</h1>
        <p className="text-sm text-slate-500">Version {PRIVACY_NOTICE_VERSION}</p>
        <p className="text-sm text-slate-700">
          This notice explains what Nightklass stores about you, why, who helps us process it, and how you can
          get a copy or delete it. If you are under 18, please read it with a parent or guardian.
        </p>
      </header>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details: your name, email address and a scrambled (hashed) version of your password.</li>
          <li>
            Study profile you choose to give: study stage (for example SS3, school leaver or university level),
            country, institution type and, for university students, programme, level and GPA entries.
          </li>
          <li>Exam goals: WAEC or JAMB, exam year, series and the subjects you choose.</li>
          <li>
            Your learning activity: courses, topics, notes and files you upload, quiz and mock answers, written
            answers, results, flashcards, study plans and the questions you report.
          </li>
          <li>
            Technical records: sign-in times, active sessions and records of AI requests (which feature, the
            model used, size and cost — not the content).
          </li>
        </ul>
        <p>We do not ask for your date of birth, phone number, home address, school ID or identity documents.</p>
      </Section>

      <Section title="Why we use it">
        <p>
          To run your account, build study plans, generate lessons and practice, mark answers, show your progress,
          keep the service secure (for example limiting repeated sign-in attempts) and fix problems. We do not sell
          your information or use it for advertising.
        </p>
      </Section>

      <Section title="AI features">
        <p>
          When you use lessons, chat, practice generation, flashcards, outline extraction or written-answer marking,
          the relevant text — such as your notes, uploaded document text, questions and your written answers — is
          sent to our AI provider, OpenAI, to produce a response. Do not include personal details (such as phone
          numbers or addresses) in notes, uploads or answers.
        </p>
        <p>
          AI marking and feedback are practice estimates. They can be wrong and are not official WAEC or JAMB
          results.
        </p>
      </Section>

      <Section title="Who processes your information for us">
        <ul className="list-disc space-y-1 pl-5">
          <li>Railway — hosts our server and database.</li>
          <li>Vercel — hosts the Nightklass website.</li>
          <li>Cloudflare R2 — stores files you upload. Files are private and opened only through short-lived links.</li>
          <li>OpenAI — processes text for AI features, as described above.</li>
          <li>Resend — sends account emails such as password resets.</li>
          <li>YouTube (Google) — receives topic names (not your details) to suggest study videos.</li>
        </ul>
        <p>
          These providers may process information outside Nigeria, including in the United States, under their own
          terms.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your account and learning records until you delete your account. Password-reset links expire after
          30 minutes, email confirmation links after 48 hours and sign-in sessions after 7 days of inactivity.
        </p>
        <p>
          When you delete your account we remove your profile details, learning content, uploaded files, exam
          records and sessions straight away. We keep only an anonymous placeholder linked to AI cost records (no
          content) so our accounts stay accurate. Copies may remain in database backups until those backups expire.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>See and download your data:</strong> Account → Download my data.
          </li>
          <li>
            <strong>Correct it:</strong> edit your profile and study details in the app, or contact us.
          </li>
          <li>
            <strong>Delete it:</strong> Account → Delete my account. This cannot be undone.
          </li>
          <li>
            <strong>Ask a question or complain:</strong> contact {contact}. You can also contact the Nigeria Data
            Protection Commission.
          </li>
        </ul>
        <p>
          Accounts created through a school or institution are managed by that institution; ask your institution
          administrator about your data.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this notice we will update the version above and ask you to review it when it matters for how
          we use your information.
        </p>
      </Section>
    </main>
  )
}
