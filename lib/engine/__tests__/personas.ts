// The 13 test personas from docs/research_checklist.md Part E.
// The engine must handle all of them before launch.
import type { Profile } from "../evaluate";

// 1. CBSE 12th, 82%, wants CS Bachelor's, no JEE → Studienkolleg/alternate route
export const p1CbseNoJee: Profile = {
  targetDegree: "bachelor",
  intake: { term: "winter", year: 2026 },
  nationality: "in",
  certificateCountry: "in",
  curriculumType: "national",
  board: "cbse",
  schoolGradePercent: 82,
  jeeAdvanced: false,
  hasExistingApsCertificate: false,
  targetField: "cs",
  visaApplicationCountry: "in",
};

// 2. CBSE 12th + JEE Advanced qualified → direct (subject-specific) access
export const p2CbseJeeAdvanced: Profile = {
  ...p1CbseNoJee,
  jeeAdvanced: true,
};

// 3. Indian 3-yr B.Sc → Master's — APS + dMAT (CS field, SS 2027 intake)
export const p3Indian3yrBsc: Profile = {
  targetDegree: "master",
  intake: { term: "summer", year: 2027 },
  nationality: "in",
  certificateCountry: "in",
  curriculumType: "national",
  hasExistingApsCertificate: false,
  visaApplicationCountry: "in",
};

// 4. Indian 4-yr B.Tech → Master's (WS 2026/27 → no dMAT)
export const p4Indian4yrBtech: Profile = {
  targetDegree: "master",
  intake: { term: "winter", year: 2026 },
  nationality: "in",
  certificateCountry: "in",
  curriculumType: "national",
  visaApplicationCountry: "in",
};

// 5. Pakistani FSc pre-engineering → Bachelor's — Studienkolleg T-Kurs or 1 yr uni
export const p5PakistaniFsc: Profile = {
  targetDegree: "bachelor",
  intake: { term: "winter", year: 2026 },
  nationality: "pk",
  certificateCountry: "pk",
  curriculumType: "national",
  board: "fsc",
  schoolGradePercent: 78,
  targetField: "engineering",
  visaApplicationCountry: "pk",
};

// 6. Pakistani 2-yr B.Com → Master's — likely insufficient alone; show options honestly
export const p6Pakistani2yrBcom: Profile = {
  targetDegree: "master",
  nationality: "pk",
  certificateCountry: "pk",
  curriculumType: "national",
  visaApplicationCountry: "pk",
};

// 7. Pakistani 4-yr BS(CS), HEC-attested → Master's — no verified rule yet → honest unknown
export const p7Pakistani4yrBs: Profile = {
  targetDegree: "master",
  nationality: "pk",
  certificateCountry: "pk",
  curriculumType: "national",
  visaApplicationCountry: "pk",
};

// 8. Saudi Tawjihiyya (science), 92% → Studienkolleg
export const p8SaudiTawjihiyah: Profile = {
  targetDegree: "bachelor",
  nationality: "sa",
  certificateCountry: "sa",
  curriculumType: "national",
  board: "tawjihiyah",
  schoolGradePercent: 92,
  visaApplicationCountry: "sa",
};

// 9. Indian passport, CBSE school in Riyadh → Bachelor's — the routing edge
//    case; visa filed from Saudi Arabia, so no APS (Riyadh checklist)
export const p9CbseInRiyadh: Profile = {
  targetDegree: "bachelor",
  intake: { term: "winter", year: 2026 },
  nationality: "in",
  certificateCountry: "sa",
  curriculumType: "national",
  board: "cbse",
  schoolGradePercent: 76,
  jeeAdvanced: false,
  visaApplicationCountry: "sa",
};

// 10. Saudi bachelor (KFUPM) → Master's — no Studienkolleg needed
export const p10SaudiBachelor: Profile = {
  targetDegree: "master",
  nationality: "sa",
  certificateCountry: "sa",
  curriculumType: "national",
  visaApplicationCountry: "sa",
};

// 11. A-Levels (CAIE) in Saudi Arabia: 3 AL (Math, Physics, CS) + 1 AS (English)
//     → CS Bachelor's — direct subject-restricted; visa from Saudi → no APS
export const p11ALevelsInSaudi: Profile = {
  targetDegree: "bachelor",
  nationality: "pk",
  certificateCountry: "sa",
  curriculumType: "gce",
  gce: {
    awardingBody: "caie",
    schoolYears: 13,
    subjects: [
      {
        independenceGroup: "mathematics",
        level: "AL",
        grade: "A",
        list: "A",
        category: "math",
      },
      {
        independenceGroup: "physics",
        level: "AL",
        grade: "A",
        list: "A",
        category: "physics",
      },
      {
        independenceGroup: "computer_science",
        level: "AL",
        grade: "B",
        list: "A",
        category: "computer_science",
      },
      {
        independenceGroup: "english_language",
        level: "AS",
        grade: "A",
        list: "A",
        category: "language",
      },
    ],
  },
  targetField: "cs",
  visaApplicationCountry: "sa",
};

// 12. A-Levels in Pakistan: 2 AL + 2 AS, no math/science AL → fails GCE formula → Studienkolleg
export const p12ALevelsInPakistan: Profile = {
  targetDegree: "bachelor",
  nationality: "pk",
  certificateCountry: "pk",
  curriculumType: "gce",
  gce: {
    awardingBody: "caie",
    schoolYears: 13,
    subjects: [
      {
        independenceGroup: "economics_business",
        level: "AL",
        grade: "B",
        list: "A",
        category: "economics",
      },
      {
        independenceGroup: "history",
        level: "AL",
        grade: "B",
        list: "A",
        category: "history",
      },
      {
        independenceGroup: "english_language",
        level: "AS",
        grade: "B",
        list: "A",
        category: "language",
      },
      {
        independenceGroup: "mathematics",
        level: "AS",
        grade: "C",
        list: "A",
        category: "math",
      },
    ],
  },
  targetField: "economics",
};

// 13. IB Diploma in India, Math AA at SL, 28 points → Mechanical Engineering Bachelor's
//     — SL math blocks STEM direct entry; APS applicability for IB-in-India is open
export const p13IbInIndia: Profile = {
  targetDegree: "bachelor",
  intake: { term: "winter", year: 2026 },
  nationality: "in",
  certificateCountry: "in",
  curriculumType: "ib",
  ib: {
    fullDiploma: true,
    totalPoints: 28,
    examYear: 2026,
    schoolYears: 12,
    mathLevel: "SL",
    mathCourse: "AA",
    subjects: [
      {
        group: 1,
        level: "HL",
        grade: 5,
        category: "language",
        foreignLanguage: true,
        recognizedForGermany: true,
      },
      {
        group: 2,
        level: "SL",
        grade: 4,
        category: "language",
        recognizedForGermany: true,
      },
      {
        group: 3,
        level: "HL",
        grade: 5,
        category: "other",
        recognizedForGermany: true,
      },
      {
        group: 4,
        level: "HL",
        grade: 5,
        category: "physics",
        recognizedForGermany: true,
      },
      {
        group: 5,
        level: "SL",
        grade: 4,
        category: "math",
        recognizedForGermany: true,
      },
      {
        group: 6,
        level: "SL",
        grade: 5,
        category: "other",
        recognizedForGermany: true,
      },
    ],
  },
  targetField: "mechanical_engineering",
};
