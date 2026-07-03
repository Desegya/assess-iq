export interface BankQuestion {
  questionText: string
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  options?: { key: string; text: string }[]
  correctAnswer: string
  explanation?: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  tags: string[]
}

export const QUESTION_BANK: BankQuestion[] = [
  // ─── BIOLOGY ─────────────────────────────────────────────────────────────────

  {
    questionText: 'Which organelle is primarily responsible for photosynthesis in plant cells?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Mitochondria' },
      { key: 'B', text: 'Chloroplast' },
      { key: 'C', text: 'Nucleus' },
      { key: 'D', text: 'Ribosome' },
    ],
    correctAnswer: 'B',
    explanation: 'Chloroplasts contain chlorophyll, which absorbs light energy for photosynthesis.',
    difficulty: 'EASY',
    tags: ['biology', 'photosynthesis', 'plant', 'cell', 'organelle', 'chloroplast'],
  },
  {
    questionText: 'The overall equation for photosynthesis produces glucose and oxygen from carbon dioxide and water.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: '6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂ is the balanced equation for photosynthesis.',
    difficulty: 'EASY',
    tags: ['biology', 'photosynthesis', 'equation'],
  },
  {
    questionText: 'Which part of the chloroplast is the site of the light-dependent reactions?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Stroma' },
      { key: 'B', text: 'Thylakoid membrane' },
      { key: 'C', text: 'Outer membrane' },
      { key: 'D', text: 'Intermembrane space' },
    ],
    correctAnswer: 'B',
    explanation: 'The thylakoid membrane contains photosystems I and II where light reactions occur.',
    difficulty: 'MEDIUM',
    tags: ['biology', 'photosynthesis', 'chloroplast', 'light reaction'],
  },
  {
    questionText: 'What is the role of chlorophyll in photosynthesis?',
    type: 'SHORT_ANSWER',
    correctAnswer: 'Chlorophyll absorbs light energy (mainly red and blue wavelengths) and converts it to chemical energy used in the light-dependent reactions.',
    difficulty: 'MEDIUM',
    tags: ['biology', 'photosynthesis', 'chlorophyll'],
  },
  {
    questionText: 'Explain the two stages of photosynthesis, describing what occurs in each stage and where in the chloroplast each takes place.',
    type: 'THEORY',
    correctAnswer: 'Stage 1: Light-dependent reactions occur in the thylakoid membrane. Light energy splits water (photolysis), produces ATP and NADPH, and releases oxygen. Stage 2: The Calvin cycle (light-independent) occurs in the stroma. CO₂ is fixed using ATP and NADPH to produce G3P, which is used to synthesise glucose.',
    difficulty: 'HARD',
    tags: ['biology', 'photosynthesis', 'calvin cycle', 'light reaction'],
  },

  // Cell biology
  {
    questionText: 'Which of the following is NOT a function of the cell membrane?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Controlling what enters and leaves the cell' },
      { key: 'B', text: 'Providing structural support to the cell' },
      { key: 'C', text: 'Protein synthesis' },
      { key: 'D', text: 'Cell signalling and communication' },
    ],
    correctAnswer: 'C',
    explanation: 'Protein synthesis occurs at ribosomes, not at the cell membrane.',
    difficulty: 'EASY',
    tags: ['biology', 'cell', 'cell membrane', 'plasma membrane'],
  },
  {
    questionText: 'Mitochondria are often called the powerhouse of the cell because they produce ATP through cellular respiration.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Mitochondria carry out aerobic respiration, producing the majority of ATP in the cell.',
    difficulty: 'EASY',
    tags: ['biology', 'cell', 'mitochondria', 'atp', 'respiration'],
  },
  {
    questionText: 'Osmosis is the movement of water molecules from a region of higher water potential to a region of lower water potential through a selectively permeable membrane.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Osmosis is a passive process requiring no energy; it moves water down its water potential gradient.',
    difficulty: 'MEDIUM',
    tags: ['biology', 'cell', 'osmosis', 'diffusion', 'membrane', 'transport'],
  },
  {
    questionText: 'What distinguishes a eukaryotic cell from a prokaryotic cell?',
    type: 'SHORT_ANSWER',
    correctAnswer: 'Eukaryotic cells have a membrane-bound nucleus and membrane-bound organelles; prokaryotic cells lack a true nucleus and most organelles.',
    difficulty: 'MEDIUM',
    tags: ['biology', 'cell', 'eukaryote', 'prokaryote', 'nucleus'],
  },

  // Genetics
  {
    questionText: 'Which nitrogenous bases are found in DNA but NOT in RNA?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Adenine' },
      { key: 'B', text: 'Thymine' },
      { key: 'C', text: 'Guanine' },
      { key: 'D', text: 'Uracil' },
    ],
    correctAnswer: 'B',
    explanation: 'DNA contains Thymine (T) paired with Adenine. RNA replaces thymine with Uracil (U).',
    difficulty: 'MEDIUM',
    tags: ['biology', 'genetics', 'dna', 'rna', 'nucleotide', 'thymine'],
  },
  {
    questionText: 'In a monohybrid cross between two heterozygous parents (Aa × Aa), what is the expected phenotypic ratio of the offspring?',
    type: 'MCQ',
    options: [
      { key: 'A', text: '1:1' },
      { key: 'B', text: '3:1' },
      { key: 'C', text: '1:2:1' },
      { key: 'D', text: '2:1' },
    ],
    correctAnswer: 'B',
    explanation: 'The Punnett square gives AA, Aa, Aa, aa — three dominant phenotype to one recessive = 3:1.',
    difficulty: 'MEDIUM',
    tags: ['biology', 'genetics', 'mendel', 'monohybrid', 'punnett', 'phenotype'],
  },
  {
    questionText: 'DNA replication is said to be semi-conservative because each new DNA molecule contains one original strand and one newly synthesised strand.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Meselson–Stahl experiment confirmed that each daughter DNA molecule retains one parental strand.',
    difficulty: 'MEDIUM',
    tags: ['biology', 'genetics', 'dna', 'replication', 'semi-conservative'],
  },

  // ─── CHEMISTRY ───────────────────────────────────────────────────────────────

  {
    questionText: 'Which of the following is an example of a strong acid?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Ethanoic acid (acetic acid)' },
      { key: 'B', text: 'Carbonic acid' },
      { key: 'C', text: 'Hydrochloric acid' },
      { key: 'D', text: 'Citric acid' },
    ],
    correctAnswer: 'C',
    explanation: 'Hydrochloric acid (HCl) fully dissociates in water, making it a strong acid.',
    difficulty: 'EASY',
    tags: ['chemistry', 'acids', 'bases', 'strong acid', 'hcl'],
  },
  {
    questionText: 'A solution with a pH of 7 is considered neutral.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'pH 7 means equal concentrations of H⁺ and OH⁻ ions, giving a neutral solution at 25°C.',
    difficulty: 'EASY',
    tags: ['chemistry', 'acids', 'bases', 'ph', 'neutral'],
  },
  {
    questionText: 'What is produced when an acid reacts with a metal carbonate?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Salt and water only' },
      { key: 'B', text: 'Salt, water, and hydrogen gas' },
      { key: 'C', text: 'Salt, water, and carbon dioxide' },
      { key: 'D', text: 'Metal oxide and water' },
    ],
    correctAnswer: 'C',
    explanation: 'Acid + metal carbonate → salt + water + CO₂. E.g. HCl + CaCO₃ → CaCl₂ + H₂O + CO₂.',
    difficulty: 'MEDIUM',
    tags: ['chemistry', 'acids', 'bases', 'carbonates', 'neutralisation'],
  },
  {
    questionText: 'The atomic number of an element represents the number of protons in its nucleus.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'The atomic number uniquely identifies each element and equals the number of protons.',
    difficulty: 'EASY',
    tags: ['chemistry', 'atomic structure', 'protons', 'atomic number', 'nucleus'],
  },
  {
    questionText: 'Which subatomic particle has no charge?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Proton' },
      { key: 'B', text: 'Electron' },
      { key: 'C', text: 'Neutron' },
      { key: 'D', text: 'Positron' },
    ],
    correctAnswer: 'C',
    explanation: 'Neutrons carry no electrical charge; protons are positive and electrons are negative.',
    difficulty: 'EASY',
    tags: ['chemistry', 'atomic structure', 'neutron', 'subatomic particle'],
  },
  {
    questionText: 'Isotopes are atoms of the same element that have the same number of protons but different numbers of neutrons.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Isotopes have identical atomic numbers but different mass numbers due to varying neutron counts.',
    difficulty: 'MEDIUM',
    tags: ['chemistry', 'atomic structure', 'isotopes', 'neutrons'],
  },
  {
    questionText: 'Elements in the same group of the periodic table have similar chemical properties because they have the same number of electrons in their outermost shell.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Valence electrons determine chemical behaviour; elements in the same group share the same valence electron count.',
    difficulty: 'MEDIUM',
    tags: ['chemistry', 'periodic table', 'group', 'valence', 'electrons'],
  },
  {
    questionText: 'Which type of bonding involves the transfer of electrons from one atom to another?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Covalent bonding' },
      { key: 'B', text: 'Metallic bonding' },
      { key: 'C', text: 'Ionic bonding' },
      { key: 'D', text: 'Hydrogen bonding' },
    ],
    correctAnswer: 'C',
    explanation: 'In ionic bonding, electrons are transferred from a metal to a non-metal, forming ions.',
    difficulty: 'EASY',
    tags: ['chemistry', 'bonding', 'ionic', 'covalent', 'electron transfer'],
  },
  {
    questionText: 'Explain what happens during electrolysis of molten lead(II) bromide, stating the products at each electrode.',
    type: 'THEORY',
    correctAnswer: 'During electrolysis, the ionic compound is melted so ions can move. At the cathode (negative electrode), lead ions (Pb²⁺) gain electrons (reduction) to form lead metal. At the anode (positive electrode), bromide ions (Br⁻) lose electrons (oxidation) to form bromine gas.',
    difficulty: 'HARD',
    tags: ['chemistry', 'electrolysis', 'electrochemistry', 'electrode', 'redox'],
  },

  // ─── PHYSICS ─────────────────────────────────────────────────────────────────

  {
    questionText: "According to Newton's First Law of Motion, an object in motion will continue in the same direction at constant speed unless acted upon by an external force.",
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'This is the law of inertia — objects resist changes to their state of motion without a net external force.',
    difficulty: 'EASY',
    tags: ['physics', 'newton', 'laws of motion', 'inertia', 'force'],
  },
  {
    questionText: "Newton's Second Law of Motion states that the net force acting on an object equals:",
    type: 'MCQ',
    options: [
      { key: 'A', text: 'mass × velocity' },
      { key: 'B', text: 'mass × acceleration' },
      { key: 'C', text: 'weight × distance' },
      { key: 'D', text: 'momentum × time' },
    ],
    correctAnswer: 'B',
    explanation: 'F = ma — force equals mass multiplied by acceleration (F measured in Newtons).',
    difficulty: 'EASY',
    tags: ['physics', 'newton', 'laws of motion', 'force', 'acceleration'],
  },
  {
    questionText: 'A car of mass 1,200 kg accelerates from rest to 20 m/s in 8 seconds. Calculate the net force acting on the car.',
    type: 'SHORT_ANSWER',
    correctAnswer: 'Acceleration = 20/8 = 2.5 m/s². Net force = ma = 1200 × 2.5 = 3,000 N.',
    difficulty: 'MEDIUM',
    tags: ['physics', 'newton', 'force', 'acceleration', 'calculation'],
  },
  {
    questionText: 'What is the SI unit of electrical resistance?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Ampere (A)' },
      { key: 'B', text: 'Volt (V)' },
      { key: 'C', text: 'Watt (W)' },
      { key: 'D', text: 'Ohm (Ω)' },
    ],
    correctAnswer: 'D',
    explanation: 'Resistance is measured in Ohms (Ω), as defined by Ohm\'s Law: V = IR.',
    difficulty: 'EASY',
    tags: ['physics', 'electricity', 'resistance', 'ohm', 'si unit'],
  },
  {
    questionText: 'Ohm\'s Law states that the current through a conductor is directly proportional to the voltage across it, provided temperature remains constant.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'V = IR — voltage and current are proportional at constant temperature for ohmic conductors.',
    difficulty: 'EASY',
    tags: ['physics', 'electricity', 'ohm', 'current', 'voltage'],
  },
  {
    questionText: 'A resistor has a voltage of 12 V across it and a current of 3 A flowing through it. What is its resistance?',
    type: 'MCQ',
    options: [
      { key: 'A', text: '0.25 Ω' },
      { key: 'B', text: '4 Ω' },
      { key: 'C', text: '36 Ω' },
      { key: 'D', text: '15 Ω' },
    ],
    correctAnswer: 'B',
    explanation: 'Using Ohm\'s Law: R = V/I = 12/3 = 4 Ω.',
    difficulty: 'MEDIUM',
    tags: ['physics', 'electricity', 'ohm', 'resistance', 'calculation'],
  },
  {
    questionText: 'Which type of wave requires a material medium for propagation?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Electromagnetic wave' },
      { key: 'B', text: 'Light wave' },
      { key: 'C', text: 'Mechanical wave' },
      { key: 'D', text: 'Radio wave' },
    ],
    correctAnswer: 'C',
    explanation: 'Mechanical waves (e.g. sound, water waves) need a medium; electromagnetic waves can travel through a vacuum.',
    difficulty: 'MEDIUM',
    tags: ['physics', 'waves', 'mechanical wave', 'electromagnetic wave', 'medium'],
  },
  {
    questionText: 'The kinetic energy of an object is directly proportional to the square of its speed.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'KE = ½mv² — doubling speed quadruples kinetic energy.',
    difficulty: 'MEDIUM',
    tags: ['physics', 'energy', 'kinetic energy', 'speed', 'velocity'],
  },
  {
    questionText: 'State and explain the Law of Conservation of Energy, giving one practical example.',
    type: 'THEORY',
    correctAnswer: 'The Law of Conservation of Energy states that energy cannot be created or destroyed; it can only be converted from one form to another, and the total energy in a closed system remains constant. Example: In a pendulum, potential energy at the highest point converts to kinetic energy at the lowest point, with the total mechanical energy remaining the same (ignoring friction).',
    difficulty: 'HARD',
    tags: ['physics', 'energy', 'conservation', 'law'],
  },

  // ─── MATHEMATICS ─────────────────────────────────────────────────────────────

  {
    questionText: 'Solve for x: 3x + 7 = 22',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'x = 3' },
      { key: 'B', text: 'x = 4' },
      { key: 'C', text: 'x = 5' },
      { key: 'D', text: 'x = 6' },
    ],
    correctAnswer: 'C',
    explanation: '3x = 22 − 7 = 15, so x = 15 ÷ 3 = 5.',
    difficulty: 'EASY',
    tags: ['mathematics', 'algebra', 'linear equation', 'solve'],
  },
  {
    questionText: 'The product of two consecutive even integers is 48. Find the smaller integer.',
    type: 'MCQ',
    options: [
      { key: 'A', text: '4' },
      { key: 'B', text: '6' },
      { key: 'C', text: '8' },
      { key: 'D', text: '12' },
    ],
    correctAnswer: 'B',
    explanation: '6 × 8 = 48. The two consecutive even integers are 6 and 8; the smaller is 6.',
    difficulty: 'MEDIUM',
    tags: ['mathematics', 'algebra', 'integers', 'consecutive'],
  },
  {
    questionText: 'The sum of angles in any triangle is always 180°.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'This is a fundamental property of triangles in Euclidean geometry.',
    difficulty: 'EASY',
    tags: ['mathematics', 'geometry', 'triangle', 'angles'],
  },
  {
    questionText: 'What is the area of a circle with radius 7 cm? (Use π ≈ 22/7)',
    type: 'MCQ',
    options: [
      { key: 'A', text: '44 cm²' },
      { key: 'B', text: '154 cm²' },
      { key: 'C', text: '22 cm²' },
      { key: 'D', text: '308 cm²' },
    ],
    correctAnswer: 'B',
    explanation: 'Area = πr² = (22/7) × 7² = (22/7) × 49 = 22 × 7 = 154 cm².',
    difficulty: 'EASY',
    tags: ['mathematics', 'geometry', 'circle', 'area'],
  },
  {
    questionText: 'In a right-angled triangle, the square of the hypotenuse is equal to the sum of squares of the other two sides.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'This is the Pythagorean theorem: a² + b² = c², where c is the hypotenuse.',
    difficulty: 'EASY',
    tags: ['mathematics', 'geometry', 'pythagoras', 'triangle', 'hypotenuse'],
  },
  {
    questionText: 'If the mean of five numbers is 12 and four of them are 10, 14, 8, and 16, what is the fifth number?',
    type: 'SHORT_ANSWER',
    correctAnswer: 'Sum of all five = 5 × 12 = 60. Sum of known four = 10 + 14 + 8 + 16 = 48. Fifth number = 60 − 48 = 12.',
    difficulty: 'MEDIUM',
    tags: ['mathematics', 'statistics', 'mean', 'average'],
  },
  {
    questionText: 'Factorise completely: x² − 5x + 6',
    type: 'MCQ',
    options: [
      { key: 'A', text: '(x − 2)(x − 3)' },
      { key: 'B', text: '(x + 2)(x + 3)' },
      { key: 'C', text: '(x − 1)(x − 6)' },
      { key: 'D', text: '(x − 2)(x + 3)' },
    ],
    correctAnswer: 'A',
    explanation: 'We need two numbers that multiply to 6 and add to −5: −2 and −3. So (x − 2)(x − 3).',
    difficulty: 'MEDIUM',
    tags: ['mathematics', 'algebra', 'factorisation', 'quadratic'],
  },
  {
    questionText: 'A bag contains 4 red balls and 6 blue balls. A ball is drawn at random. What is the probability that it is red?',
    type: 'MCQ',
    options: [
      { key: 'A', text: '2/5' },
      { key: 'B', text: '3/5' },
      { key: 'C', text: '1/4' },
      { key: 'D', text: '4/6' },
    ],
    correctAnswer: 'A',
    explanation: 'P(red) = 4/(4+6) = 4/10 = 2/5.',
    difficulty: 'EASY',
    tags: ['mathematics', 'probability', 'statistics', 'random'],
  },
  {
    questionText: 'Prove that the sum of the interior angles of a quadrilateral is 360°.',
    type: 'THEORY',
    correctAnswer: 'A quadrilateral can be divided into two triangles by drawing one diagonal. The sum of angles in each triangle is 180°. Therefore, the total sum of interior angles of the quadrilateral = 2 × 180° = 360°.',
    difficulty: 'MEDIUM',
    tags: ['mathematics', 'geometry', 'quadrilateral', 'angles', 'proof'],
  },
  {
    questionText: 'What is the value of sin 30°?',
    type: 'MCQ',
    options: [
      { key: 'A', text: '√3/2' },
      { key: 'B', text: '1/2' },
      { key: 'C', text: '1/√2' },
      { key: 'D', text: '√3' },
    ],
    correctAnswer: 'B',
    explanation: 'sin 30° = 0.5 = 1/2. This is a standard trigonometric value to memorise.',
    difficulty: 'EASY',
    tags: ['mathematics', 'trigonometry', 'sine', 'angle'],
  },

  // ─── ENGLISH LANGUAGE ────────────────────────────────────────────────────────

  {
    questionText: 'Which of the following sentences contains a grammatical error?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'She and I went to the market.' },
      { key: 'B', text: 'The teacher, together with his students, are going on a trip.' },
      { key: 'C', text: 'Neither the boys nor the girl was present.' },
      { key: 'D', text: 'Each of the students has submitted the assignment.' },
    ],
    correctAnswer: 'B',
    explanation: '"Together with" is a parenthetical phrase; the subject is "teacher" (singular), so the verb should be "is going", not "are going".',
    difficulty: 'HARD',
    tags: ['english', 'grammar', 'subject-verb agreement', 'syntax'],
  },
  {
    questionText: 'A pronoun must agree in number and gender with its antecedent.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Pronoun-antecedent agreement is a fundamental grammar rule — singular antecedents take singular pronouns.',
    difficulty: 'EASY',
    tags: ['english', 'grammar', 'pronoun', 'antecedent', 'agreement'],
  },
  {
    questionText: 'The word "ubiquitous" most nearly means:',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Rare and precious' },
      { key: 'B', text: 'Found everywhere; widespread' },
      { key: 'C', text: 'Confusing or ambiguous' },
      { key: 'D', text: 'Ancient or historic' },
    ],
    correctAnswer: 'B',
    explanation: '"Ubiquitous" means present, appearing, or found everywhere at the same time.',
    difficulty: 'HARD',
    tags: ['english', 'vocabulary', 'word meaning', 'adjective'],
  },
  {
    questionText: 'An adverb modifies a verb, adjective, or another adverb.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Adverbs answer questions like how, when, where, and to what extent, modifying verbs, adjectives, or other adverbs.',
    difficulty: 'EASY',
    tags: ['english', 'grammar', 'adverb', 'parts of speech'],
  },
  {
    questionText: 'Which literary device is used in the sentence: "The wind whispered through the trees"?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Simile' },
      { key: 'B', text: 'Hyperbole' },
      { key: 'C', text: 'Personification' },
      { key: 'D', text: 'Alliteration' },
    ],
    correctAnswer: 'C',
    explanation: 'Personification gives human qualities to non-human things. Wind cannot literally whisper — this is a human trait attributed to wind.',
    difficulty: 'MEDIUM',
    tags: ['english', 'literature', 'literary device', 'personification', 'figurative language'],
  },
  {
    questionText: 'What is the difference between a metaphor and a simile? Give an example of each.',
    type: 'THEORY',
    correctAnswer: 'A simile makes a comparison using "like" or "as" (e.g. "He runs like the wind"). A metaphor makes a direct comparison without "like" or "as" (e.g. "He is a lion on the field"). Both are figurative comparisons, but similes use explicit connectors while metaphors state the comparison directly.',
    difficulty: 'MEDIUM',
    tags: ['english', 'literature', 'literary device', 'metaphor', 'simile', 'figurative language'],
  },

  // ─── GOVERNMENT / CIVICS ─────────────────────────────────────────────────────

  {
    questionText: 'Nigeria operates a federal system of government, meaning power is shared between the federal and state governments.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Nigeria\'s 1999 Constitution establishes a federal structure with the Federal Government, 36 States, and the FCT.',
    difficulty: 'EASY',
    tags: ['government', 'nigeria', 'federal', 'constitution', 'politics'],
  },
  {
    questionText: 'Which arm of government is responsible for making laws in Nigeria?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'The Executive' },
      { key: 'B', text: 'The Judiciary' },
      { key: 'C', text: 'The Legislature' },
      { key: 'D', text: 'The Cabinet' },
    ],
    correctAnswer: 'C',
    explanation: 'The Legislature (National Assembly at federal level — Senate and House of Representatives) makes laws.',
    difficulty: 'EASY',
    tags: ['government', 'nigeria', 'legislature', 'laws', 'arms of government'],
  },
  {
    questionText: 'The concept of the Rule of Law means that no person or institution is above the law.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'The Rule of Law, as defined by A.V. Dicey, holds that every person and institution is subject to the law.',
    difficulty: 'EASY',
    tags: ['government', 'rule of law', 'constitution', 'dicey'],
  },
  {
    questionText: 'Separation of Powers is a constitutional principle designed to:',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'Concentrate all power in the hands of the president' },
      { key: 'B', text: 'Prevent any one branch from having too much power' },
      { key: 'C', text: 'Allow the judiciary to make laws' },
      { key: 'D', text: 'Give the legislature control over the courts' },
    ],
    correctAnswer: 'B',
    explanation: 'Separation of Powers (Montesquieu) divides government into executive, legislative, and judiciary to prevent tyranny through checks and balances.',
    difficulty: 'MEDIUM',
    tags: ['government', 'separation of powers', 'montesquieu', 'checks and balances'],
  },

  // ─── ECONOMICS ───────────────────────────────────────────────────────────────

  {
    questionText: 'The Law of Demand states that, all other things being equal, as the price of a good increases, the quantity demanded decreases.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'There is an inverse relationship between price and quantity demanded, ceteris paribus, giving the demand curve its downward slope.',
    difficulty: 'EASY',
    tags: ['economics', 'demand', 'law of demand', 'price', 'quantity'],
  },
  {
    questionText: 'Which of the following is an example of a public good?',
    type: 'MCQ',
    options: [
      { key: 'A', text: 'A loaf of bread from a bakery' },
      { key: 'B', text: 'National defence' },
      { key: 'C', text: 'A cinema ticket' },
      { key: 'D', text: 'A private hospital room' },
    ],
    correctAnswer: 'B',
    explanation: 'Public goods are non-excludable and non-rival — national defence protects everyone simultaneously without depleting the service.',
    difficulty: 'MEDIUM',
    tags: ['economics', 'public good', 'non-excludable', 'non-rival'],
  },
  {
    questionText: 'Inflation is a sustained increase in the general price level of goods and services in an economy.',
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: 'Inflation erodes purchasing power over time and is measured by indices like the Consumer Price Index (CPI).',
    difficulty: 'EASY',
    tags: ['economics', 'inflation', 'price level', 'cpi'],
  },
  {
    questionText: 'What is the difference between GDP and GNP?',
    type: 'SHORT_ANSWER',
    correctAnswer: 'GDP (Gross Domestic Product) measures the total value of goods and services produced within a country\'s borders, regardless of the nationality of producers. GNP (Gross National Product) measures the total output of a country\'s residents, including production abroad but excluding output by foreign residents within the country.',
    difficulty: 'MEDIUM',
    tags: ['economics', 'gdp', 'gnp', 'national income', 'macroeconomics'],
  },
  {
    questionText: 'Describe the concept of elasticity of demand and explain how it affects pricing decisions by businesses.',
    type: 'THEORY',
    correctAnswer: 'Price elasticity of demand (PED) measures how responsive quantity demanded is to a change in price. If PED > 1, demand is elastic — a price increase leads to a proportionally larger fall in quantity demanded, reducing revenue. If PED < 1, demand is inelastic — price increases raise revenue because quantity falls by a smaller proportion. Businesses use this to maximise revenue: firms with inelastic demand (e.g. necessities, utilities) can raise prices without losing many customers, while those with elastic demand must compete on price.',
    difficulty: 'HARD',
    tags: ['economics', 'elasticity', 'demand', 'pricing', 'revenue'],
  },
]

/**
 * Score a bank question by how many of its tags appear in the user's search terms.
 */
export function scoreQuestion(q: BankQuestion, searchTerms: string[]): number {
  return q.tags.filter(tag => searchTerms.some(term => tag.includes(term) || term.includes(tag))).length
}

/**
 * Build template questions when the bank doesn't have enough topic-matched items.
 */
export function buildTemplateQuestions(
  topic: string,
  requestedTypes: string[],
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  needed: number,
): BankQuestion[] {
  const templates: BankQuestion[] = []

  const theoryQ: BankQuestion = {
    questionText: `Describe the concept of "${topic}" in detail, explaining its key principles and significance.`,
    type: 'THEORY',
    correctAnswer: `A comprehensive explanation of ${topic} should cover its definition, underlying principles, practical applications, and importance within the subject area.`,
    difficulty,
    tags: [],
  }

  const shortQ: BankQuestion = {
    questionText: `Define "${topic}" and give one example of how it applies in practice.`,
    type: 'SHORT_ANSWER',
    correctAnswer: `${topic} refers to [the core concept]. An example of this in practice is [a relevant application].`,
    difficulty,
    tags: [],
  }

  const tfQ: BankQuestion = {
    questionText: `A thorough understanding of "${topic}" is essential for mastering the broader subject.`,
    type: 'TRUE_FALSE',
    correctAnswer: 'True',
    explanation: `${topic} is a foundational concept that underpins many related ideas in the discipline.`,
    difficulty,
    tags: [],
  }

  const mcqQ: BankQuestion = {
    questionText: `Which of the following statements best describes "${topic}"?`,
    type: 'MCQ',
    options: [
      { key: 'A', text: `${topic} is primarily concerned with theoretical frameworks only` },
      { key: 'B', text: `${topic} involves the systematic study of related principles and their applications` },
      { key: 'C', text: `${topic} is irrelevant to practical problem-solving` },
      { key: 'D', text: `${topic} was developed recently with no historical context` },
    ],
    correctAnswer: 'B',
    difficulty,
    tags: [],
  }

  const pool = requestedTypes.includes('THEORY')       ? [theoryQ, shortQ, tfQ, mcqQ]
             : requestedTypes.includes('SHORT_ANSWER') ? [shortQ, tfQ, mcqQ, theoryQ]
             : requestedTypes.includes('TRUE_FALSE')   ? [tfQ, mcqQ, theoryQ, shortQ]
             : [mcqQ, tfQ, shortQ, theoryQ]

  for (let i = 0; i < needed; i++) {
    templates.push(pool[i % pool.length]!)
  }

  return templates
}
