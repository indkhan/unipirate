import { describe, expect, it } from "vitest"
import {
  getAdmissionRoute,
  getUpcomingCourses,
  getProfileCompleteness,
  sortCoursesByDeadline,
} from "./dashboard"
import { blankProfile } from "./profile"
import { parseSavedCourses, type SavedCourse } from "./saved-courses"

describe("dashboard derivations", () => {
  it("reports profile completeness and missing fields", () => {
    expect(getProfileCompleteness(blankProfile)).toEqual({
      percentage: 0,
      missingFields: [
        "Country of education",
        "Qualification",
        "Grade",
        "Grading scale",
        "Language certificate",
        "Preferred language",
      ],
    })
  })

  it("maps a reviewed H+ rule to direct admission", () => {
    const profile = {
      ...blankProfile,
      country: "India",
      qualification: "Bachelor's",
    }
    const route = getAdmissionRoute(profile, [
      {
        country: "India",
        qualificationType: "Bachelor's",
        status: "H+",
        headline: "Direct access",
        explanation: "The qualification is recognized.",
        nextSteps: ["Choose a course"],
        actionLinks: [],
      },
    ])

    expect(route.status).toBe("Direct admission likely")
  })

  it("rejects malformed stored courses and sorts valid courses by deadline", () => {
    const courses = parseSavedCourses(
      JSON.stringify([
        course({ id: "later", deadline: "2027-07-15" }),
        { id: "invalid" },
        course({ id: "earlier", deadline: "2027-05-02" }),
      ]),
    )

    expect(sortCoursesByDeadline(courses).map(({ id }) => id)).toEqual(["earlier", "later"])
    expect(
      getUpcomingCourses(courses, new Date("2027-06-01T00:00:00Z")).map(({ id }) => id),
    ).toEqual(["later"])
  })
})

function course(overrides: Partial<SavedCourse>): SavedCourse {
  return {
    id: "course",
    name: "Computer Science",
    university: "Sample University",
    city: "Berlin",
    language: "English",
    semester: "Winter",
    deadline: "2027-06-30",
    applicationRoute: "University portal",
    admissionType: "NC-free",
    status: "In progress",
    readiness: 50,
    missingItems: [],
    ...overrides,
  }
}
