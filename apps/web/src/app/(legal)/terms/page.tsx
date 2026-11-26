import type { Metadata } from 'next'
import Link from 'next/link'
import { Contact, LegalPage, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="26 November 2026"
      intro={
        <>
          These terms cover using KwikEval as a lecturer or a student. By creating an account you agree to them and to our{' '}
          <Link href="/privacy" className="text-violet-700 underline">privacy notice</Link>.
        </>
      }
    >
      <Section title="Your account">
        <p>
          Use your real name and an email address you control. Keep your password private; you are responsible for what happens under
          your account. Students must not let anyone else sit a test for them.
        </p>
      </Section>

      <Section title="For lecturers">
        <ul className="list-disc space-y-1 pl-5">
          <li>Only upload notes and questions you have the right to use, and do not upload other people&rsquo;s personal information.</li>
          <li>Check AI-generated questions before using them. They can be wrong or unclear.</li>
          <li>
            You decide who can join your classes and what results mean. KwikEval is a tool to help you test students; grading decisions,
            appeals and academic records remain your and your institution&rsquo;s responsibility.
          </li>
        </ul>
      </Section>

      <Section title="For students">
        <ul className="list-disc space-y-1 pl-5">
          <li>Sit tests yourself and follow your lecturer&rsquo;s rules for each test.</li>
          <li>
            Tests may watch for leaving the page or full screen and submit automatically after repeated warnings, or when time runs out.
            Answers saved before then are kept.
          </li>
          <li>Ask your lecturer, not KwikEval, about marks and appeals.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <p>
          Do not try to access other people&rsquo;s classes or answers, get around time limits or access rules, overload the service, or use
          it for anything unlawful. We may suspend accounts that do.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          KwikEval is free while it is in early access. We work to keep it available and your work safe, but we cannot promise it will
          never be interrupted. For high-stakes exams, have a back-up plan, such as a paper copy.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update these terms; the date above shows the latest version, and we will tell you in the app about important changes.
          Questions: <Contact />.
        </p>
      </Section>
    </LegalPage>
  )
}
