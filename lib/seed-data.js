// Curated reference data for the 7 target countries.
// Researched June 2026 — anabin (anabin.kmk.org) is the source of truth;
// admin must verify each rule before launch. Every verdict in the UI carries
// a "verify on anabin" disclaimer + link.

const ANABIN = 'https://anabin.kmk.org/anabin.html';
const APS_INDIA = 'https://aps-india.de/';
const APS_CHINA = 'https://www.aps.org.cn/';
const UNI_ASSIST = 'https://www.uni-assist.de/en/';

// status ∈ 'H+' | 'H+/-' | 'H-' | 'H+ (subject-restricted)' | 'UNCLEAR'
export const RECOGNITION_RULES = [
  // ---------------- INDIA ----------------
  {
    country: 'India',
    qualification_type: 'Standard 12th (CBSE/ICSE/State Board)',
    status: 'H-',
    headline: 'Not sufficient on its own.',
    explanation:
      'From Winter Semester 2026/27, an Indian Class XII certificate gives direct access only with at least 70% overall AND one of: one year at a recognised Indian university, a qualifying JEE Advanced/NEET score, or a Studienkolleg. Below 70%, you must complete a Studienkolleg and pass the Feststellungsprüfung.',
    next_steps: [
      'Obtain the APS India certificate — mandatory for every Indian applicant.',
      'If you have ≥70%: complete 1 year at a recognised Indian university, OR secure a qualifying JEE Advanced/NEET score, OR attend a Studienkolleg.',
      'If below 70%: attend a Studienkolleg in Germany and pass the Feststellungsprüfung.',
      'Prepare language proof: TestDaF/DSH for German-taught programs, IELTS/TOEFL for English-taught.',
    ],
    action_links: [
      { label: 'APS India', href: APS_INDIA, kind: 'aps' },
      { label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' },
    ],
    anabin_url: ANABIN,
    needs_aps: true,
    grade_threshold: 70,
    grade_threshold_kind: 'raw_percent',
    status_if_below: 'H-',
    headline_if_below: 'Studienkolleg required.',
    explanation_if_below:
      'With under 70% in Class XII, direct entry is not available. You must complete a one-year Studienkolleg and pass the Feststellungsprüfung before applying to a bachelor’s program.',
    next_steps_if_below: [
      'Obtain the APS India certificate — mandatory for every Indian applicant.',
      'Apply to a Studienkolleg, attend the one-year course, and pass the Feststellungsprüfung.',
      'Prepare language proof (German for most Studienkollegs).',
    ],
  },
  {
    country: 'India',
    qualification_type: "Indian Bachelor's (recognised university, subject match)",
    status: 'H+',
    headline: 'Direct access for bachelor’s programs.',
    explanation:
      'A bachelor’s from a recognised Indian university (anabin H+ institution), in a matching subject, generally grants direct university entrance qualification in Germany.',
    next_steps: [
      'Obtain the APS India certificate before applying.',
      'Apply via uni-assist or the university portal.',
      'Provide language proof matching the program’s language of instruction.',
    ],
    action_links: [
      { label: 'APS India', href: APS_INDIA, kind: 'aps' },
      { label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' },
    ],
    anabin_url: ANABIN,
    needs_aps: true,
  },
  {
    country: 'India',
    qualification_type: 'JEE Advanced (qualified)',
    status: 'H+ (subject-restricted)',
    headline: 'Direct subject-restricted access to technical programs.',
    explanation:
      'A qualifying JEE Advanced result, together with a Class XII certificate of at least 70%, gives direct subject-restricted access to engineering and technical bachelor’s programs — and typically exempts you from the TestAS. APS India is still mandatory. Enter your Class XII percentage as your grade.',
    next_steps: [
      'Obtain the APS India certificate — mandatory for every Indian applicant.',
      'Confirm your Class XII overall is ≥70% and keep your JEE Advanced scorecard.',
      'Apply to an engineering/technical program via uni-assist or the university portal.',
      'Prepare language proof: TestDaF/DSH for German-taught programs, IELTS/TOEFL for English-taught.',
    ],
    action_links: [
      { label: 'APS India', href: APS_INDIA, kind: 'aps' },
      { label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' },
    ],
    anabin_url: ANABIN,
    needs_aps: true,
  },

  // ---------------- CHINA ----------------
  {
    country: 'China',
    qualification_type: 'Gaokao',
    status: 'H+ (subject-restricted)',
    headline: 'Direct subject-restricted access with ≥70% of the provincial maximum.',
    explanation:
      'A Gaokao result of at least 70% of your province’s maximum score grants fachgebundene (subject-restricted) direct access — no Studienkolleg needed. Medicine, pharmacy, veterinary science and dentistry require at least 80% plus relevant science subjects. The APS uses the simplified, document-only Gaokao-Verfahren.',
    next_steps: [
      'Obtain the APS certificate (simplified Gaokao-Verfahren, no interview).',
      'Apply directly or via uni-assist for a subject related to your Gaokao profile.',
      'Provide language proof (German or English depending on the program).',
    ],
    action_links: [
      { label: 'APS China', href: APS_CHINA, kind: 'aps' },
      { label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' },
    ],
    anabin_url: ANABIN,
    needs_aps: true,
    grade_threshold: 70,
    grade_threshold_kind: 'raw_percent',
    status_if_below: 'H-',
    headline_if_below: 'Studienkolleg required.',
    explanation_if_below:
      'With under 70% of the provincial Gaokao maximum, you must complete a one-year Studienkolleg and pass the Feststellungsprüfung before applying.',
    next_steps_if_below: [
      'Obtain the APS certificate.',
      'Attend a Studienkolleg and pass the Feststellungsprüfung.',
      'Prepare German language proof.',
    ],
  },

  // ---------------- PAKISTAN ----------------
  {
    country: 'Pakistan',
    qualification_type: 'HSSC / Intermediate',
    status: 'H-',
    headline: 'Not sufficient on its own.',
    explanation:
      'A Pakistani HSSC/Intermediate certificate is not equivalent to the German Abitur. You need either one year at a recognised Pakistani university before applying, or a Studienkolleg in Germany followed by the Feststellungsprüfung. No APS is required for Pakistan.',
    next_steps: [
      'Complete 1 year at a recognised (anabin H+) Pakistani university, OR plan for a Studienkolleg.',
      'If Studienkolleg: apply, attend the one-year course, pass the Feststellungsprüfung.',
      'Apply via uni-assist; prepare language proof (German or English by program).',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },
  {
    country: 'Pakistan',
    qualification_type: "Pakistani Bachelor's (recognised university)",
    status: 'H+/-',
    headline: 'Conditional access.',
    explanation:
      'One to two successfully completed semesters at an anabin H+ Pakistani institution generally give conditional admission (bedingte Zulassung). Subject match and the exact number of semesters depend on the university.',
    next_steps: [
      'Confirm your institution is rated H+ in anabin.',
      'Apply via uni-assist with transcripts for completed semesters.',
      'Provide language proof matching the program.',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },

  // ---------------- MALAYSIA ----------------
  {
    country: 'Malaysia',
    qualification_type: 'STPM (with SPM)',
    status: 'H+',
    headline: 'Direct access for bachelor’s programs.',
    explanation:
      'The Sijil Tinggi Persekolahan Malaysia (STPM), together with SPM, is generally recognised for direct application to German bachelor’s programs. No APS is required for Malaysia.',
    next_steps: [
      'Apply directly or via uni-assist.',
      'Provide language proof (German or English depending on the program).',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },
  {
    country: 'Malaysia',
    qualification_type: 'UEC / Matriculation / Foundation / Diploma',
    status: 'H-',
    headline: 'Generally not recognised on its own.',
    explanation:
      'UEC, matriculation, and private-college foundation/diploma programs are generally not recognised for direct entry. Take a recognised pre-university qualification (STPM, A-Level, or IB), or complete a Studienkolleg.',
    next_steps: [
      'Pursue STPM, A-Level, or IB, OR plan for a Studienkolleg + Feststellungsprüfung.',
      'Apply via uni-assist; prepare language proof.',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },

  // ---------------- SAUDI ARABIA ----------------
  {
    country: 'Saudi Arabia',
    qualification_type: 'Thanawiya Amma / US-system school',
    status: 'H-',
    headline: 'Studienkolleg required.',
    explanation:
      'A Saudi secondary certificate (Thanawiya Amma or US-system) is not equivalent to the Abitur. Complete a Studienkolleg and pass the Feststellungsprüfung, or prove two successful years at a corresponding university. A Goethe "Studienkolleg Middle East" operates in Saudi Arabia. No APS required.',
    next_steps: [
      'Plan for a Studienkolleg (incl. the Goethe Studienkolleg Middle East) + Feststellungsprüfung, OR 2 years at a corresponding university.',
      'Reach the required German level (B1–B2 depending on the Studienkolleg track).',
      'Apply via uni-assist.',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },

  // ---------------- UAE ----------------
  {
    country: 'UAE',
    qualification_type: 'Thanawiya (secondary certificate)',
    status: 'H-',
    headline: 'Studienkolleg generally required — verify on anabin.',
    explanation:
      'A UAE secondary certificate generally requires a Studienkolleg + Feststellungsprüfung before applying. Recognition is curriculum/stream dependent — verify your exact certificate on anabin or with uni-assist. No APS required.',
    next_steps: [
      'Verify your certificate on anabin / with uni-assist.',
      'Plan for a Studienkolleg + Feststellungsprüfung unless an alternative path applies.',
      'Apply via uni-assist; prepare language proof.',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },

  // ---------------- KUWAIT ----------------
  {
    country: 'Kuwait',
    qualification_type: 'Shahadat Al-Thanawiya Al-Amma',
    status: 'H-',
    headline: 'Studienkolleg generally required — verify on anabin.',
    explanation:
      'The Kuwaiti general secondary certificate generally requires a Studienkolleg + Feststellungsprüfung before applying. Verify your exact certificate on anabin or with uni-assist. No APS required.',
    next_steps: [
      'Verify your certificate on anabin / with uni-assist.',
      'Plan for a Studienkolleg + Feststellungsprüfung.',
      'Apply via uni-assist; prepare language proof.',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },

  // ---------------- UNIVERSAL / INTERNATIONAL ----------------
  // country 'Any' = matched for this qualification regardless of the user's
  // selected country (see matchRecognitionRule). A-Levels / IB are recognised
  // directly and never need APS, even for Indian/Chinese holders.
  {
    country: 'Any',
    qualification_type: 'GCE A-Levels',
    status: 'H+ (subject-restricted)',
    headline: 'Direct subject-restricted access.',
    explanation:
      'GCE A-Levels are recognised as a direct (subject-restricted) university entrance qualification in Germany when you have at least four independent, general-education subjects — including a language and Mathematics or a natural science — with at least three passed at A-Level. You can apply directly to programs related to your subjects. No APS is required: the APS validates national-system schooling, not international boards, so A-Levels are exempt even if taken in India or China (confirm your individual case with your local APS office).',
    next_steps: [
      'Confirm your subject combination (≥4 subjects incl. a language + Maths/science, ≥3 at A-Level).',
      'Apply directly or via uni-assist — no APS needed for A-Levels.',
      'Provide language proof matching the program (IELTS/TOEFL for English, TestDaF/DSH for German).',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },
  {
    country: 'Any',
    qualification_type: 'IB Diploma',
    // Base status = general access (when HL Maths + HL natural science present).
    // Subject gating reuses the *_if_below columns: ib_subjects kind selects the
    // restricted variant when the HL subjects are missing.
    status: 'H+',
    headline: 'Direct access to all subjects.',
    explanation:
      'A full IB Diploma (six subjects, three at Higher Level, at least 24 points) is recognised for direct admission in Germany. Because your diploma includes HL Mathematics and a HL natural science, you have unrestricted (general) direct access to any subject. No APS is required: the APS validates national-system schooling, not international boards, so the IB is exempt even if taken in India or China (confirm your individual case with your local APS office).',
    next_steps: [
      'Confirm the diploma meets the minimum (6 subjects, 3 HL, ≥24 points, each of the 6 ≥4).',
      'Apply directly or via uni-assist — no APS needed for the IB.',
      'Provide language proof matching the program (IELTS/TOEFL for English, TestDaF/DSH for German).',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
    grade_threshold: 1, // sentinel: enables gating; kind below drives the logic
    grade_threshold_kind: 'ib_subjects',
    status_if_below: 'H+ (subject-restricted)',
    headline_if_below: 'Direct subject-restricted access.',
    explanation_if_below:
      'A full IB Diploma (six subjects, three at Higher Level, at least 24 points) is recognised for direct admission in Germany. Without both HL Mathematics and a HL natural science, your access is subject-restricted — you can apply to programs related to your Higher-Level subjects. Adding HL Maths + a HL natural science would give unrestricted access. No APS is required: the APS validates national-system schooling, not international boards, so the IB is exempt even if taken in India or China (confirm your individual case with your local APS office).',
    next_steps_if_below: [
      'Confirm the diploma meets the minimum (6 subjects, 3 HL, ≥24 points, each of the 6 ≥4).',
      'Target programs related to your Higher-Level subjects, or add HL Maths + a HL science for general access.',
      'Apply directly or via uni-assist — no APS needed for the IB.',
      'Provide language proof matching the program.',
    ],
  },
  {
    country: 'Any',
    qualification_type: 'Studienkolleg (completed)',
    status: 'H+',
    headline: 'Direct access — you hold a German entrance qualification.',
    explanation:
      'A completed Studienkolleg with a passed Feststellungsprüfung is a German higher-education entrance qualification (HZB). You apply directly to bachelor’s programs in the subject area of your Studienkolleg course (T-Kurs for technical/science, M-Kurs for medicine, W-Kurs for economics, etc.). No APS is needed at this stage. Enter your Feststellungsprüfung result on the German 1.0–6.0 scale.',
    next_steps: [
      'Apply directly or via uni-assist to programs matching your Studienkolleg course (T/M/W/G/S-Kurs).',
      'Submit your Feststellungsprüfung certificate as your entrance qualification.',
      'Provide language proof (usually already covered by the Studienkolleg; DSH/TestDaF otherwise).',
    ],
    action_links: [{ label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' }],
    anabin_url: ANABIN,
    needs_aps: false,
  },

  // ---------------- FALLBACK ----------------
  {
    country: 'Other / Not listed',
    qualification_type: 'Any',
    status: 'UNCLEAR',
    headline: 'Manual check recommended.',
    explanation:
      'Your country/qualification combination is not in our curated dataset yet. That does not rule you out — verify your qualification directly on anabin and with uni-assist.',
    next_steps: [
      'Look up your qualification on anabin.',
      'Contact uni-assist or your target university’s international office.',
    ],
    action_links: [
      { label: 'anabin', href: ANABIN, kind: 'manual' },
      { label: 'uni-assist', href: UNI_ASSIST, kind: 'apply' },
    ],
    anabin_url: ANABIN,
    needs_aps: false,
  },
];

// Modified Bavarian Formula parameters per qualification/scale.
// germanGrade = 1 + 3*(n_max - grade)/(n_max - n_min). Values are board-dependent
// approximations shown to the user with a disclaimer.
export const GRADE_CONVERSION = [
  { qualification_type: 'Standard 12th (CBSE/ICSE/State Board)', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 33, notes: 'CBSE pass mark 33%.' },
  { qualification_type: "Indian Bachelor's (recognised university, subject match)", grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 40, notes: 'Typical bachelor pass 40%.' },
  { qualification_type: "Indian Bachelor's (recognised university, subject match)", grading_scale: 'CGPA out of 10', n_max: 10, n_min: 4, notes: 'CGPA/10, pass ~4.0.' },
  { qualification_type: 'Gaokao', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 60, notes: 'Expressed as % of provincial max; pass ~60%.' },
  { qualification_type: 'HSSC / Intermediate', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 33, notes: 'Pakistan HSSC pass 33%.' },
  { qualification_type: "Pakistani Bachelor's (recognised university)", grading_scale: 'CGPA out of 4', n_max: 4, n_min: 2.0, notes: 'Pakistan bachelor CGPA/4, pass ~2.0.' },
  { qualification_type: "Pakistani Bachelor's (recognised university)", grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 40, notes: 'Pakistan bachelor %, pass ~40%.' },
  { qualification_type: 'STPM (with SPM)', grading_scale: 'CGPA out of 4', n_max: 4.0, n_min: 2.0, notes: 'STPM GPA 4.0 scale.' },
  { qualification_type: 'Thanawiya Amma / US-system school', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 50, notes: 'Gulf Thanawiya pass ~50%.' },
  { qualification_type: 'Thanawiya (secondary certificate)', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 50, notes: 'Gulf Thanawiya pass ~50%.' },
  { qualification_type: 'Shahadat Al-Thanawiya Al-Amma', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 50, notes: 'Gulf Thanawiya pass ~50%.' },
  // A-Levels: per-subject letters mapped A*=6 … E=1, averaged over best subjects.
  { qualification_type: 'GCE A-Levels', grading_scale: 'A-Level grades', n_max: 6, n_min: 1, notes: 'A*=6, A=5, B=4, C=3, D=2, E=1; average of best subjects.' },
  // Generic scale fallbacks (matched by scale when no qual-specific row exists).
  { qualification_type: '*', grading_scale: 'Percentage (0–100)', n_max: 100, n_min: 40, notes: 'Generic percentage default.' },
  { qualification_type: '*', grading_scale: 'CGPA out of 10', n_max: 10, n_min: 4, notes: 'Generic CGPA/10.' },
  { qualification_type: '*', grading_scale: 'CGPA out of 4', n_max: 4, n_min: 1.7, notes: 'Generic CGPA/4.' },
  { qualification_type: '*', grading_scale: 'IB points (0–45)', n_max: 45, n_min: 24, notes: 'IB diploma pass 24.' },
  { qualification_type: '*', grading_scale: 'German scale (1.0–6.0)', n_max: 1.0, n_min: 4.0, notes: 'Identity — already German; pass-through.' },
];

export const COUNTRY_PLAYBOOKS = [
  { country: 'India', steps: ['Get the APS India certificate', 'Confirm recognition path (≥70% direct / Studienkolleg)', 'Prepare language proof', 'Shortlist programs & deadlines', 'Apply via uni-assist or university portal', 'Apply for student visa'] },
  { country: 'China', steps: ['Get the APS certificate (Gaokao-Verfahren)', 'Confirm ≥70% subject-restricted access', 'Prepare language proof', 'Shortlist programs & deadlines', 'Apply via uni-assist or university portal', 'Apply for student visa'] },
  { country: 'Pakistan', steps: ['Confirm 1-year-uni or Studienkolleg path', 'Prepare language proof', 'Shortlist programs & deadlines', 'Apply via uni-assist', 'Apply for student visa'] },
  { country: 'Malaysia', steps: ['Confirm STPM recognition (or alternative)', 'Prepare language proof', 'Shortlist programs & deadlines', 'Apply via uni-assist or university portal', 'Apply for student visa'] },
  { country: 'Saudi Arabia', steps: ['Plan Studienkolleg (Goethe Middle East option)', 'Reach required German level', 'Pass the Feststellungsprüfung', 'Apply via uni-assist', 'Apply for student visa'] },
  { country: 'UAE', steps: ['Verify certificate on anabin', 'Plan Studienkolleg + Feststellungsprüfung', 'Prepare language proof', 'Apply via uni-assist', 'Apply for student visa'] },
  { country: 'Kuwait', steps: ['Verify certificate on anabin', 'Plan Studienkolleg + Feststellungsprüfung', 'Prepare language proof', 'Apply via uni-assist', 'Apply for student visa'] },
];
