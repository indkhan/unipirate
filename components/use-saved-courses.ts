"use client"

import { useEffect, useState } from "react"
import type { Course, University } from "@/lib/data"
import {
  parseSavedCourses,
  saveableCourse,
  type SavedCourse,
} from "@/lib/saved-courses"

const storageKey = "unipirate:saved-courses"

export function useSavedCourses() {
  const [courses, setCourses] = useState<SavedCourse[] | null>(null)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setCourses(parseSavedCourses(localStorage.getItem(storageKey)))
    })
    return () => {
      active = false
    }
  }, [])

  const toggle = (course: Course, university: University) => {
    const current = courses ?? []
    const next = current.some(({ id }) => id === course.id)
      ? current.filter(({ id }) => id !== course.id)
      : [...current, saveableCourse(course, university)]

    setCourses(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Saving remains available in memory when browser storage is restricted.
    }
  }

  return {
    courses: courses ?? [],
    loaded: courses !== null,
    isSaved: (courseId: string) => courses?.some(({ id }) => id === courseId) ?? false,
    toggle,
  }
}
