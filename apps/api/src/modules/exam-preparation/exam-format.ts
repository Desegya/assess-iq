/**
 * What a Nightklass mock does not contain, frozen into each attempt and shown
 * before starting, during the mock and with results. The question bank has no
 * passage, image or audio support yet, so no mock is a complete reproduction of
 * an official paper, whatever its question count.
 */
export const FORMAT_LIMITS = {
  JAMB: [
    'Comprehension and cloze passages, and other questions that share a reading text',
    'Diagrams, graphs, maps, tables and images',
    'The official computer-based test interface and its exact question distribution',
  ],
  WAEC: [
    'Comprehension and summary passages, and other questions that share a reading text',
    'Diagrams, graphs, maps, tables and images, including drawing or labelling answers',
    'Practical, oral and listening components',
    'Separate marking of each sub-part (written answers are marked as one response)',
  ],
} as const

export function formatDisclosure(exam: 'JAMB' | 'WAEC') {
  return {
    textOnly: true,
    notIncluded: [...FORMAT_LIMITS[exam]],
    summary:
      exam === 'JAMB'
        ? 'Text-only practice mock built from Nightklass-reviewed questions, not past JAMB papers. It leaves out passage-based and diagram-based questions, so it is not a complete UTME paper and the score is a practice estimate.'
        : 'Text-only practice paper built from Nightklass-reviewed questions, not past WAEC papers. It leaves out passage-, diagram-, practical- and oral-based components, so it is not a complete WASSCE paper and marks are practice estimates.',
  }
}
