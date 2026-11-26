import type { Metadata } from 'next'
import { Contact, LegalPage, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Privacy notice' }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      updated="26 November 2026"
      intro="This notice explains what KwikEval stores, who can see it, who helps us process it, and how to get a copy or have it deleted."
    >
      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details: your name, email address and a scrambled (hashed) password. Lecturers may add where they teach.</li>
          <li>Classes: which classes you created or joined, and whether a lecturer let you in or removed you.</li>
          <li>Teaching material lecturers add: notes, uploaded documents, questions and tests.</li>
          <li>Test activity: when you started and submitted, your answers, your marks and any written feedback.</li>
          <li>Technical records: sign-in times, active sessions and records of AI requests (which feature, model, size and cost, not the content).</li>
        </ul>
        <p>We do not ask for your date of birth, phone number, home address, student ID or identity documents.</p>
      </Section>

      <Section title="Who can see what">
        <p>
          <strong>Your lecturer</strong> sees, for their own classes only, your name and email, whether you joined, and your answers
          and marks on their tests. Lecturers cannot see other lecturers&rsquo; classes or results.
        </p>
        <p>
          <strong>Students</strong> see their own answers and marks. Whether they see the correct answers afterwards is the
          lecturer&rsquo;s choice.
        </p>
      </Section>

      <Section title="Why we use it">
        <p>
          To run your account, let lecturers set and mark tests, show results, keep the service secure (for example limiting repeated
          sign-in attempts and checking school email addresses) and fix problems. We do not sell your information or use it for advertising.
        </p>
      </Section>

      <Section title="AI features">
        <p>
          When a lecturer generates questions from notes, the text of those notes is sent to our AI provider, OpenAI, to write draft
          questions. Lecturers review AI questions before using them; they can be wrong. Student answers are not sent to AI for marking:
          lecturers mark written answers themselves.
        </p>
      </Section>

      <Section title="Who processes information for us">
        <ul className="list-disc space-y-1 pl-5">
          <li>Railway: hosts our server and database.</li>
          <li>Vercel: hosts the KwikEval website.</li>
          <li>Cloudflare R2: stores uploaded files privately, opened only through short-lived links.</li>
          <li>OpenAI: processes lecturers&rsquo; notes for AI question generation.</li>
          <li>Resend: sends account emails such as email confirmations and password resets.</li>
        </ul>
        <p>These providers may process information outside your country, including in the United States, under their own terms.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep accounts, classes and test results until the account is deleted, so lecturers can refer back to past results.
          Password-reset links expire after 30 minutes, email confirmation links after 48 hours and sign-in sessions after 7 days of
          inactivity. Copies may remain in database backups until those backups expire.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>To get a copy of your data, correct it or delete your account, contact <Contact />.</li>
          <li>To leave a class, ask your lecturer to remove you; your past results stay with the lecturer.</li>
          <li>You can also complain to the data protection authority in your country.</li>
        </ul>
      </Section>

      <Section title="Changes">
        <p>If we change this notice we will update the date above and tell you in the app when it matters for how we use your information.</p>
      </Section>
    </LegalPage>
  )
}
