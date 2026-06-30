export type RecognitionStatus = "H+" | "H" | "H-" | "UNCLEAR"

export type ActionLink = {
  href: string
  label: string
  kind: "aps" | "kolleg" | "apply" | "manual"
}

export type RecognitionRule = {
  country: string
  qualificationType: string
  status: RecognitionStatus
  headline: string
  explanation: string
  nextSteps: string[]
  actionLinks: ActionLink[]
}

export type University = {
  id: string
  name: string
  short: string
  city: string
  state: string
  portalType: string
  generalDeadlines: string
  semesterContribution: string
  blurb: string
}

export type Course = {
  id: string
  universityId: string
  name: string
  degree: string
  language: string
  semester: string
  ncFree: boolean
  ncValue?: string
  applicationDeadline: string
  summary: string
  keywords?: string[]
  admissionRequirements: string
  languageRequirements: string
  courseStructure: string
  howToApply: string
}

export type UniPirateData = {
  countries: string[]
  qualificationsByCountry: Record<string, string[]>
  gradingScales: string[]
  languageCertificates: string[]
  recognitionRules: RecognitionRule[]
  universities: University[]
  courses: Course[]
}

// Replace these empty collections with reviewed domain data when it is available.
export const data: UniPirateData = {
  countries: [],
  qualificationsByCountry: {},
  gradingScales: [],
  languageCertificates: [],
  recognitionRules: [],
  universities: [],
  courses: [],
}

export const hasDataset =
  data.countries.length > 0 &&
  data.recognitionRules.length > 0 &&
  data.universities.length > 0 &&
  data.courses.length > 0
