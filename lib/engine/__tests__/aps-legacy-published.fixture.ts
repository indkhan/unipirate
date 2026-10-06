import type { EngineRule } from "../evaluate";

// Supplied anonymous public inventory, read 2026-10-07. Historical metadata,
// not current official proof. Preserve real UUID identities and July dates.
export const legacyPublishedAps = [
  {
    "id": "2bf1bdf4-a0a3-4116-b905-fb2c164a6504",
    "conditions": {
      "visa_application_country": "sa"
    },
    "outcomes": {
      "aps": "not_required",
      "note": "The German Embassy Riyadh student-visa checklist does not ask for an APS certificate — for Saudi citizens or for non-Saudi nationals residing in Saudi Arabia (Iqama holders). APS applies per visa jurisdiction, not nationality."
    },
    "status": "verified",
    "source_url": "https://www.vfsglobal.com/Germany/SaudiArabia/pdf/Checklist_Student_Visa.pdf",
    "source_quote": "CHECKLIST FOR STUDENT VISA — Additional documents required for non-Saudi nationals residing in Saudi Arabia: For non-Saudi citizens: Original Iqama with 2 photocopies; valid Saudi Arabian Exit Visa. (No APS certificate appears anywhere on the Embassy Riyadh checklist.)",
    "last_verified_at": "2026-07-07T00:00:00+00:00",
    "notes": "Bootstrap candidate: aps-not-required-visa-from-sa. Review in /admin before publishing.",
    "created_at": "2026-07-07T09:50:54.580565+00:00",
    "updated_at": "2026-07-07T09:57:34.330162+00:00",
    "slug": "aps-not-required-visa-from-sa",
    "country_code": "sa"
  },
  {
    "id": "f5361a7c-bddf-45fd-9c8d-a23e736f16cc",
    "conditions": {
      "curriculum": "national",
      "certificate_country": "in",
      "visa_application_country": "in"
    },
    "outcomes": {
      "aps": "required",
      "note": "APS India verifies qualifications issued by Indian educational institutions; its certificate is required when the student visa is filed with the German Missions in India.",
      "documents": [
        "APS India certificate"
      ]
    },
    "status": "verified",
    "source_url": "https://aps-india.de/",
    "source_quote": "APS India verifies academic documents and qualifications issued by Indian educational institutions; the APS certificate is generally required for the German student-visa procedure.",
    "last_verified_at": "2026-07-07T00:00:00+00:00",
    "notes": "Bootstrap candidate: aps-india-national. Review in /admin before publishing.",
    "created_at": "2026-07-05T09:06:19.617351+00:00",
    "updated_at": "2026-07-07T09:57:34.208745+00:00",
    "slug": "aps-india-national",
    "country_code": "in"
  }
] satisfies EngineRule[];
