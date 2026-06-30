import { describe, expect, it } from "vitest"
import { blankProfile, parseStoredProfile } from "./profile"

describe("parseStoredProfile", () => {
  it("uses the blank profile when storage is empty or malformed", () => {
    expect(parseStoredProfile(null)).toEqual(blankProfile)
    expect(parseStoredProfile("{broken")).toEqual(blankProfile)
  })

  it("accepts a complete stored profile", () => {
    const profile = {
      ...blankProfile,
      country: "India",
      qualification: "Bachelor's",
      prefLanguage: "English" as const,
    }

    expect(parseStoredProfile(JSON.stringify(profile))).toEqual(profile)
  })

  it("defaults missing and invalid fields safely", () => {
    expect(parseStoredProfile('{"country":"India","prefLanguage":"Klingon"}')).toEqual({
      ...blankProfile,
      country: "India",
    })
  })
})
