"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { blankProfile, parseStoredProfile, type Profile } from "@/lib/profile"

type ProfileContextValue = {
  profile: Profile
  setProfile: Dispatch<SetStateAction<Profile>>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)
const storageKey = "unipirate:profile"

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(blankProfile)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        setProfile(parseStoredProfile(localStorage.getItem(storageKey)))
      } catch {
        // Ignore malformed or unavailable browser storage.
      } finally {
        setStorageReady(true)
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(profile))
    } catch {
      // Storage may be restricted by the browser.
    }
  }, [profile, storageReady])

  return <ProfileContext value={{ profile, setProfile }}>{children}</ProfileContext>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error("useProfile must be used within ProfileProvider")
  return context
}
