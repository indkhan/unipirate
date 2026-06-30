import type { Course, University } from "@/lib/data"

export type SavedCourse = {
  id: string
  name: string
  university: string
  city: string
  language: string
  semester: string
  deadline: string
  applicationRoute: string
  admissionType: string
  status: string
  readiness: number
  missingItems: string[]
}

export function saveableCourse(course: Course, university: University): SavedCourse {
  return {
    id: course.id,
    name: course.name,
    university: university.name,
    city: university.city,
    language: course.language,
    semester: course.semester,
    deadline: course.applicationDeadline,
    applicationRoute: university.portalType,
    admissionType: course.ncFree ? "NC-free" : course.ncValue || "Restricted admission",
    status: "Saved",
    readiness: 0,
    missingItems: ["Review admission requirements"],
  }
}

export function parseSavedCourses(raw: string | null): SavedCourse[] {
  if (!raw) return []

  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []

    return value.filter((course): course is SavedCourse => {
      if (!course || typeof course !== "object") return false
      const item = course as Record<string, unknown>
      return (
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.university === "string" &&
        typeof item.city === "string" &&
        typeof item.language === "string" &&
        typeof item.semester === "string" &&
        typeof item.deadline === "string" &&
        typeof item.applicationRoute === "string" &&
        typeof item.admissionType === "string" &&
        typeof item.status === "string" &&
        typeof item.readiness === "number" &&
        Array.isArray(item.missingItems) &&
        item.missingItems.every((entry) => typeof entry === "string")
      )
    })
  } catch {
    return []
  }
}
