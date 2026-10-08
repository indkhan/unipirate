// UP-PROC-02 source-reviewed draft candidates. Never runtime or publication authority.
// Review due is editorial policy, not an invented source effective date.
import type {EngineRule} from "../lib/engine/evaluate";
export const processCandidates: (EngineRule & {country:string|null})[] = [
  {
    "id": "in-study-funding-process",
    "country": "in",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "funding",
        "fact_key": "livelihood",
        "jurisdiction": "in",
        "purposes": [
          "study"
        ],
        "amounts": [
          {
            "amount": "11,904.—",
            "currency": "EUR",
            "period": "first year of studies"
          },
          {
            "amount": "992.—",
            "currency": "EUR",
            "period": "per month"
          }
        ],
        "alternatives": [
          {
            "method": "blocked_account",
            "text": "Blocked bank account"
          },
          {
            "method": "commitment",
            "text": "Verpflichtungserklärung"
          },
          {
            "method": "scholarship",
            "text": "German or EU scholarship or stipend"
          }
        ],
        "additional": [
          "Education loan: please also provide proof of that"
        ],
        "source_date_annotation": "16.02.2026 - Article",
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [],
        "editorial_advice": []
      }
    },
    "source_url": "https://india.diplo.de/in-en/service/2756350-2756350",
    "source_quote": "Proof of secure livelihood",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Education loan proof is additional, not sufficient alone; each alternative needs mission-confirmed coverage."
  },
  {
    "id": "in-national-visa-fee-over18-process",
    "country": "in",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "visa_fee",
        "fact_key": "national_fee",
        "jurisdiction": "in",
        "purposes": [
          "study"
        ],
        "amounts": [
          {
            "amount": "8300",
            "currency": "inr",
            "period": "application"
          },
          {
            "amount": "75,--",
            "currency": "EUR",
            "period": "application"
          }
        ],
        "alternatives": [],
        "additional": [],
        "source_date_annotation": "01.10.2026 - Article",
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [],
        "editorial_advice": [],
        "age": {
          "min": 19,
          "max": null
        },
        "unresolved_observations": [
          {
            "amounts": [
              {
                "amount": "8400",
                "currency": "inr",
                "period": "application"
              }
            ],
            "source_url": "https://india.diplo.de/in-en/service/2755482-2755482",
            "source_quote": "8400 INR",
            "last_verified_at": null,
            "note": "Supplied earlier evidence; not reproduced by this retrieval. Human reconciliation required; no payable instruction."
          }
        ]
      }
    },
    "source_url": "https://india.diplo.de/in-en/service/2755482-2755482",
    "source_quote": "8300 inr / 75,-- EUR for applicants over 18 years of age",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Supplied INR 8400 versus retrieved inr 8300 unresolved; no latest winner. Exactly 18 uncovered. Day-of-appointment local exchange-rate instruction needs mission confirmation."
  },
  {
    "id": "in-national-visa-fee-under18-process",
    "country": "in",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "visa_fee",
        "fact_key": "national_fee",
        "jurisdiction": "in",
        "purposes": [
          "study"
        ],
        "amounts": [
          {
            "amount": "4200",
            "currency": "inr",
            "period": "application"
          },
          {
            "amount": "37,50",
            "currency": "EUR",
            "period": "application"
          }
        ],
        "alternatives": [],
        "additional": [],
        "source_date_annotation": "01.10.2026 - Article",
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [],
        "editorial_advice": [],
        "age": {
          "min": null,
          "max": 17
        }
      }
    },
    "source_url": "https://india.diplo.de/in-en/service/2755482-2755482",
    "source_quote": "4200 inr / 37,50 EUR",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Exactly 18 uncovered. Local payable currency is Indian Rupees; no conversion."
  },
  {
    "id": "sa-study-funding-process",
    "country": "sa",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "funding",
        "fact_key": "livelihood",
        "jurisdiction": "sa",
        "purposes": [
          "study"
        ],
        "amounts": [
          {
            "amount": "11.904",
            "currency": "€",
            "period": "year"
          }
        ],
        "alternatives": [
          {
            "method": "commitment",
            "text": "formal obligation letter"
          },
          {
            "method": "scholarship",
            "text": "scholarship confirmation"
          }
        ],
        "additional": [
          "employment letter, confirmed by the local Chamber of Commerce",
          "current bank statements of yourself or your sponsor covering the last 6 months"
        ],
        "source_date_annotation": "(2024)",
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [],
        "editorial_advice": []
      }
    },
    "source_url": "https://saudiarabien.diplo.de/ksa-en/visa-service/study-preparatory-courses-2195208",
    "source_quote": "11.904 €/year (2024)",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Source annotation is not a commencement date. No conversion."
  },
  {
    "id": "sa-study-visa-fee-process",
    "country": "sa",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "visa_fee",
        "fact_key": "national_fee",
        "jurisdiction": "sa",
        "purposes": [
          "study"
        ],
        "amounts": [
          {
            "amount": "75",
            "currency": "€",
            "period": "application"
          }
        ],
        "alternatives": [],
        "additional": [],
        "source_date_annotation": null,
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [],
        "editorial_advice": []
      }
    },
    "source_url": "https://saudiarabien.diplo.de/ksa-en/visa-service/study-preparatory-courses-2195208",
    "source_quote": "visa fee of 75€, to be paid in SAR (cash only)",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Payable SAR amount unknown. Source does not specify age bracket; no actionable fee guidance."
  },
  {
    "id": "pk-study-portal-islamabad-process",
    "country": "pk",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "appointment",
        "fact_key": "student_portal",
        "jurisdiction": "pk",
        "purposes": [
          "study"
        ],
        "amounts": [],
        "alternatives": [],
        "additional": [],
        "source_date_annotation": "27.11.2025 - Article",
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [
          {
            "order": 43,
            "text": "Scan and submit/upload all your documents"
          }
        ],
        "editorial_advice": [],
        "mission": "islamabad"
      }
    },
    "source_url": "https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104",
    "source_quote": "ongoing demand still exceeds our capacity",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Mission identity is explicitly reported, not certified. Questionnaire supplies required documents; no amount or APS exemption inferred. Current retrieved page explicitly covers Karachi as well as Islamabad."
  },
  {
    "id": "pk-study-portal-karachi-process",
    "country": "pk",
    "status": "draft",
    "conditions": {},
    "outcomes": {
      "process": {
        "kind": "appointment",
        "fact_key": "student_portal",
        "jurisdiction": "pk",
        "purposes": [
          "study"
        ],
        "amounts": [],
        "alternatives": [],
        "additional": [],
        "source_date_annotation": "27.11.2025 - Article",
        "effective": {
          "from": null,
          "through": null,
          "intake_indices": null
        },
        "review_due": "2026-11-08T02:24:14Z",
        "steps": [
          {
            "order": 43,
            "text": "Scan and submit/upload all your documents"
          }
        ],
        "editorial_advice": [],
        "mission": "karachi"
      }
    },
    "source_url": "https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104",
    "source_quote": "ongoing demand still exceeds our capacity",
    "last_verified_at": "2026-10-08T02:24:14Z",
    "notes": "Draft only. Mission identity is explicitly reported, not certified. Questionnaire supplies required documents; no amount or APS exemption inferred. Current retrieved page explicitly covers Karachi as well as Islamabad."
  }
];
