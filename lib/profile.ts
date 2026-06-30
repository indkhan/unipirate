export const instructionLanguages = ["Any", "German", "English"] as const

export type Profile = {
  country: string
  qualification: string
  grade: string
  gradingScale: string
  languageCert: string
  languageScore: string
  prefLanguage: (typeof instructionLanguages)[number]
}

export const blankProfile: Profile = {
  country: "",
  qualification: "",
  grade: "",
  gradingScale: "",
  languageCert: "",
  languageScore: "",
  prefLanguage: "Any",
}

export function parseStoredProfile(raw: string | null): Profile {
  if (!raw) return blankProfile

  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return blankProfile

    const candidate = value as Record<string, unknown>
    const text = (key: keyof Profile) =>
      typeof candidate[key] === "string" ? candidate[key] : ""
    const prefLanguage = instructionLanguages.includes(
      candidate.prefLanguage as Profile["prefLanguage"],
    )
      ? (candidate.prefLanguage as Profile["prefLanguage"])
      : "Any"

    return {
      country: text("country"),
      qualification: text("qualification"),
      grade: text("grade"),
      gradingScale: text("gradingScale"),
      languageCert: text("languageCert"),
      languageScore: text("languageScore"),
      prefLanguage,
    }
  } catch {
    return blankProfile
  }
}
