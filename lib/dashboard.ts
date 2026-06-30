import type { RecognitionRule } from "@/lib/data"
import type { Profile } from "@/lib/profile"
import type { SavedCourse } from "@/lib/saved-courses"

export type ItemStatus = "done" | "missing" | "unclear" | "not_required"

export type AdmissionRoute = {
  status:
    | "Direct admission likely"
    | "Studienkolleg likely required"
    | "Subject-restricted admission"
    | "Unclear"
    | "Profile incomplete"
  explanation: string
  nextSteps: string[]
}

const profileFields: Array<{ key: keyof Profile; label: string; valid?: (value: string) => boolean }> = [
  { key: "country", label: "Country of education" },
  { key: "qualification", label: "Qualification" },
  { key: "grade", label: "Grade" },
  { key: "gradingScale", label: "Grading scale" },
  { key: "languageCert", label: "Language certificate" },
  { key: "prefLanguage", label: "Preferred language", valid: (value) => value !== "Any" },
]

export function getProfileCompleteness(profile: Profile) {
  const missingFields = profileFields
    .filter(({ key, valid }) => {
      const value = profile[key]
      return !value || (valid ? !valid(value) : false)
    })
    .map(({ label }) => label)

  return {
    percentage: Math.round(((profileFields.length - missingFields.length) / profileFields.length) * 100),
    missingFields,
  }
}

export function getAdmissionRoute(
  profile: Profile,
  recognitionRules: RecognitionRule[],
): AdmissionRoute {
  if (!profile.country || !profile.qualification) {
    return {
      status: "Profile incomplete",
      explanation: "Complete your education profile before we can estimate your admission route.",
      nextSteps: ["Add your country of education", "Select your qualification", "Enter your grade"],
    }
  }

  const rule =
    recognitionRules.find(
      ({ country, qualificationType }) =>
        country === profile.country && qualificationType === profile.qualification,
    ) ??
    recognitionRules.find(
      ({ country, qualificationType }) =>
        country === profile.country && qualificationType === "Any",
    )

  if (!rule || rule.status === "UNCLEAR") {
    return {
      status: "Unclear",
      explanation: "No reviewed recognition rule is available for this profile yet.",
      nextSteps: ["Check anabin", "Ask your target university", "Review uni-assist requirements"],
    }
  }

  if (rule.status === "H+") {
    return {
      status: "Direct admission likely",
      explanation: rule.explanation,
      nextSteps: rule.nextSteps,
    }
  }

  if (rule.status === "H") {
    return {
      status: "Subject-restricted admission",
      explanation: rule.explanation,
      nextSteps: rule.nextSteps,
    }
  }

  return {
    status: "Studienkolleg likely required",
    explanation: rule.explanation,
    nextSteps: rule.nextSteps,
  }
}

export function sortCoursesByDeadline(courses: SavedCourse[]) {
  return [...courses].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
  )
}

export function getUpcomingCourses(courses: SavedCourse[], now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return sortCoursesByDeadline(courses).filter(
    ({ deadline }) => new Date(`${deadline}T00:00:00Z`).getTime() >= today,
  )
}
