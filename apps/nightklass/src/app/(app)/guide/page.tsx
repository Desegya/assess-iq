import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'

const steps = [
  {
    title: '1. Add what you are studying',
    body: 'Open My Courses and add a course by title, choose suggestions from your programme, or upload an outline. For example: BIO 101 Introduction to Biology. Check that suggestions match what your lecturer teaches.',
    href: '/courses/new',
    action: 'Add a course',
  },
  {
    title: '2. Review the topic outline',
    body: 'Open the course and check its topics. Edit AI suggestions before accepting them, or use your lecturer’s outline. A topic is one part of the course, such as Cell Structure. You can upload notes to help Nightklass teach from your material.',
    href: '/courses',
    action: 'Open My Courses',
  },
  {
    title: '3. Set a study routine',
    body: 'In the course’s Study setup, choose the days and times you can study. Add an exam date if you know it, or choose a semester or fixed number of weeks. Generate a plan to turn your topics into study sessions.',
    href: '/courses',
    action: 'Set up a course plan',
  },
  {
    title: '4. Learn, practise and return',
    body: 'Open Today to see your sessions. Open a topic for lesson notes and worked examples, then try its quiz or flashcards. Check AI explanations against your teaching material, and report a lesson if something seems wrong.',
    href: '/today',
    action: 'See Today',
  },
]

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="A little help"
        title="Your first course, step by step."
        description="You can start with just a course title. There is no need to know every feature before you begin."
        icon="book"
      />
      {steps.map((step) => (
        <section key={step.title} className="card space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
          <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
          <Link
            href={step.href}
            className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 underline"
          >
            {step.action} →
          </Link>
        </section>
      ))}
      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Changing your courses</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          My Courses shows all your saved courses. Adding one does not replace another. You can also
          switch courses from the selector at the top of a course page.
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          Use Edit course for a typo, course code, level or exam date. If you chose an entirely
          different subject by mistake, delete that course and add the correct one: renaming it
          would keep the old topics and lessons. Deletion asks you to confirm because it removes
          study content.
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          For WAEC/JAMB, use Edit subjects on your exam goal to change the subject selection first.
          Its study workspace can then be deleted from My Courses.
        </p>
      </section>
    </div>
  )
}
