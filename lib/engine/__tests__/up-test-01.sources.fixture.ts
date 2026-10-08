// Literal reviewed evidence, not an expected-outcome oracle derived from candidates.
// Source file hashes identify base53e bytes; verification is never commencement.
export const REVIEWED_SOURCE_HASHES = {
  "scripts/gce.rules.ts": "4052c8da43bb96c4d226ede0ac7eb03ecdef27be85757a23de189cce41d06f61",
  "scripts/ib.rules.ts": "45eeb70b3d66452b4427563961cdde546339f9a4617c9762cae6297af268d78a",
  "scripts/india-study.rules.ts": "2bb32986e5db26838b881639d72bfd97662bd865cc8bf8661d3529876bb1eceb",
  "scripts/pakistan.rules.ts": "098460fa1799ffdf043aa8e032854fbcc38194b4bed239512f1794b64f840907",
  "scripts/saudi.rules.ts": "75b2e07f99deddfe5248e831c4697edd118ddcda49d8dcac03475f69a2f357bf",
  "scripts/dmat.rules.ts": "345b190088cbf2653d45bdb1b6ff77d44eb2ec4ac833aea83ce70e6bdb3916da",
  "scripts/rules.bootstrap.ts": "ff4ff4c0f3f1dd6f248233ca9a5003d255a7bf2e130d6c5bc8add47634afc9d7",
  "lib/engine/ib-annexes.json": "29e3fd3f38ab781bd020c392219c08fd41e33ae3855ded76ffd579e571825b47",
  "lib/engine/__tests__/india-study-legacy.fixture.json": "7818451eb5398b0289029925811f0fd319a3d5b97d75d2854c2b7a1396bbebc6"
} as const;
export const REVIEWED_SOURCES: Record<string, {url: string; quote: string; verifiedAt: string; file: string; applicability: string}> = {
  "GCE-DAAD": {
    "url": "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    "quote": "3 general, independent subjects at A Level with a minimum grade of C",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/gce.rules.ts",
    "applicability": "Current ordinary coverage 4053/4054/4055; historical national-system and List C variants held"
  },
  "GCE-CAMBRIDGE": {
    "url": "https://www.cambridgeinternational.org/Images/648183-pre-u-recognition-in-germany.pdf",
    "quote": "Universities will apply the new framework already from summer semester 2022, if it is more favourable for admission purposes.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/gce.rules.ts",
    "applicability": "Favourable ordinary Cambridge AL formula from Summer2022; not Pre-U conversion"
  },
  "IB-CURRENT-ORDINARY": {
    "url": "https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/aktuell/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2023-06-15_Liste1__2026-03-26_Liste2-2024-11-19.pdf",
    "quote": "Die geforderten sechs Fächer müssen mindestens mit der IB-Note 4 benotet sein.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/ib.rules.ts",
    "applicability": "Ordinary examination evidence; intake4051 onward; exact annex session/programme separately required"
  },
  "IB-CURRENT-COMPENSATED": {
    "url": "https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/aktuell/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2023-06-15_Liste1__2026-03-26_Liste2-2024-11-19.pdf",
    "quote": "Sofern in nur einem Fach die IB-Note 3 vorliegt, kann diese ausgeglichen werden, wenn in einem weiteren Fach auf mindestens demselben Anspruchsniveau mindestens die IB-Note 5 und insgesamt mindestens 24 Punkte erzielt worden sind.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/ib.rules.ts",
    "applicability": "Reviewed one-grade3 compensation; same-or-higher level; total24; exact annex scope when relevant"
  },
  "IB-HISTORICAL-ORDINARY": {
    "url": "https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2022-03-24_Liste1-2023-03-01_Liste2-2023-03-01_DE.pdf",
    "quote": "Die geforderten sechs Fächer müssen mindestens mit der IB-Note 4 benotet sein.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/ib.rules.ts",
    "applicability": "Examination2013..2020 legacy mathematics or2021..2024; target intake4051 onward"
  },
  "IB-HISTORICAL-COMPENSATED": {
    "url": "https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2022-03-24_Liste1-2023-03-01_Liste2-2023-03-01_DE.pdf",
    "quote": "Sofern in nur einem Fach die IB-Note 3 vorliegt, kann diese ausgeglichen werden, wenn in einem weiteren Fach auf mindestens demselben Anspruchsniveau mindestens die IB-Note 5 und insgesamt mindestens 24 Punkte erzielt worden sind.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/ib.rules.ts",
    "applicability": "Historical ordinary agreement compensation; target intake4051 onward"
  },
  "IB-DOCUMENT": {
    "url": "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    "quote": "German universities do not accept a so-called IB Certificate.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/ib.rules.ts",
    "applicability": "Document uncertainty only; no automatic preparation alternative"
  },
  "INDIA-STUDY": {
    "url": "https://aps-india.de/news/",
    "quote": "The academic year must form part of a regular Bachelor’s degree program and must have been successfully completed.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/india-study.rules.ts",
    "applicability": "Current explicit school-only/successful-year reports; policy intake >=4053; source review not commencement"
  },
  "JEE-ORDINARY": {
    "url": "https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=4&ad-layerId=63",
    "quote": "direct subject-restricted admission",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Ordinary Main+Advanced; applicable reported technology/natural-science target;4053/4054/4055"
  },
  "PK-PREP-SCIENCE": {
    "url": "https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=6&ad-layerId=193",
    "quote": "Medicine, Natural Sciences and Technology",
    "verifiedAt": "2026-10-07T23:15:59Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Science preparatory family only; no source effective intake established"
  },
  "PK-PREP-COMMERCE": {
    "url": "https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=6&ad-layerId=197",
    "quote": "Social Sciences and Economics",
    "verifiedAt": "2026-10-07T23:15:59Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Commerce preparatory family only; no source effective intake established"
  },
  "PK-PREP-HUMANITIES": {
    "url": "https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=6&ad-layerId=204",
    "quote": "subject area of Humanities",
    "verifiedAt": "2026-10-07T23:15:59Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Humanities preparatory family only; no source effective intake established"
  },
  "PK-REVIEW": {
    "url": "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/pk/",
    "quote": "overview of subjects and grades",
    "verifiedAt": "2026-10-07T23:15:59Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Completed/other/uncertain qualifications held"
  },
  "PK-MASTER": {
    "url": "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/pk/",
    "quote": "minimum passing grade for your degree to be awarded",
    "verifiedAt": "2026-10-07T23:15:59Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Master remains unknown; no equivalence established"
  },
  "PAK-BV01": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en) — Das nachzuweisende Studienjahr muss an einer anerkannten Hochschule in einem wissenschaftlichen Studiengang absolviert worden sein.",
    "verifiedAt": "2026-10-08T01:24:33Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Humanities current one-year;4053/4054/4055; DAAD206 retrieval failure not contrary"
  },
  "PAK-BV02": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en) — Das nachzuweisende Studienjahr muss an einer anerkannten Hochschule in einem wissenschaftlichen Studiengang absolviert worden sein.",
    "verifiedAt": "2026-10-08T01:24:33Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Commerce current one-year;4053/4054/4055; corroborating DAAD199"
  },
  "PAK-BV03": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en) — Das nachzuweisende Studienjahr muss an einer anerkannten Hochschule in einem wissenschaftlichen Studiengang absolviert worden sein.",
    "verifiedAt": "2026-10-08T01:24:33Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Science current one-year;4053/4054/4055; corroborating DAAD195"
  },
  "PK-BROCHURE": {
    "url": "https://www.daad.pk/files/2022/11/Study-in-Germany-Undergraduate-Degree-Courses_2022.pdf",
    "quote": "FSc + two successfully completed years",
    "verifiedAt": "2026-10-08T01:24:33Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Evidence-only discrepancy; not competing current path or claimed withdrawal"
  },
  "PK-STUDY-REVIEW": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en)",
    "verifiedAt": "2026-10-08T01:24:33Z",
    "file": "scripts/pakistan.rules.ts",
    "applicability": "Individual confirmation; contrary assessment distinct from resolver conflict"
  },
  "SAU-BV05-ONE": {
    "url": "https://www.uni-assist.de/tools/laenderhinweise/laenderdetails/country/sa/",
    "quote": "in einem Bachelor-Studium an einer anerkannten Hochschule erfolgreich abgeschlossen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Private v2 one-year previous-field preparation;4053/4054/4055"
  },
  "SAU-BV05-TWO": {
    "url": "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/",
    "quote": "Successful completion of two years of studies",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Private v2 two-year previous/neighbouring direct;4053/4054/4055"
  },
  "SAU-INDUSTRIAL-PREP": {
    "url": "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/",
    "quote": "From the 2026/27 winter semester onwards",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Enrollment-field FH preparation;4053/4054/4055"
  },
  "SAU-BV6": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "Direkter Zugang (fachorientiert)\nfür die bisherige Fachrichtung und benachbarte Fächer\nbei Nachweis von 1 erfolgreichen Studienjahr(en)\nnur zu Fachhochschulen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Industrial successful-year FH direct; uni-assist WS2026/27 regime;4053/4054/4055"
  },
  "SAU-BV01-PREP": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "zu allen Hochschulen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Literary restricted preparation;4053/4054/4055"
  },
  "SAU-BV02-PREP": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "Feststellungsprüfung/Studienkolleg (für alle Schwerpunktkurse)",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Science all Schwerpunktkurse;4053/4054/4055"
  },
  "SAU-BV03-PREP": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "zu allen Hochschulen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Commercial economics preparation;4053/4054/4055"
  },
  "SAU-BV01-YEAR": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en)\nzu allen Hochschulen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Literary successful-year previous/neighbouring direct;4053/4054/4055"
  },
  "SAU-BV02-YEAR": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en)\nzu allen Hochschulen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Science successful-year previous/neighbouring direct;4053/4054/4055"
  },
  "SAU-BV03-YEAR": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "bei Nachweis von 1 erfolgreichen Studienjahr(en)\nzu allen Hochschulen",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Commercial successful-year previous/neighbouring direct;4053/4054/4055"
  },
  "SAU-BACHELOR": {
    "url": "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang",
    "quote": "Bachelor",
    "verifiedAt": "2026-10-08T00:00:00Z",
    "file": "scripts/saudi.rules.ts",
    "applicability": "Completed recognised >=4 nominal years general undergraduate; Master held;4053/4054/4055"
  },
  "APS-TRANSITION-BEFORE": {
    "url": "https://aps-india.de/news/",
    "quote": "Applications submitted before the implementation date (15 March 2026)",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Confirmed relevant complete submission; March date not registration/dispatch"
  },
  "APS-TRANSITION-CURRENT": {
    "url": "https://aps-india.de/news/",
    "quote": "a minimum overall score of 70%",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "On/afterMarch15; below70 current two-route criterion; no positive route invented"
  },
  "APS-QUALIFICATION": {
    "url": "https://www.kmk.org/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/APS_2015_12_10.pdf",
    "quote": "Studienbewerber zugelassen, die das Zertifikat bzw. die Bescheinigung der Akademischen Prüfstelle als Nachweis der Erfüllung der in den Bewertungsvorschlägen der Kultusministerkonferenz festgelegten Voraussetzungen für die Aufnahme eines Erststudiums vorlegen können.",
    "verifiedAt": "2026-10-06T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Indian national qualification first-study recognition only"
  },
  "APS-APPLICATION": {
    "url": "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/",
    "quote": "your APS certificate (from the Academic Evaluation Centre, https://aps-india.de/)",
    "verifiedAt": "2026-10-06T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Indian national issuer, reported uni-assist application"
  },
  "APS-ACQUISITION": {
    "url": "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/",
    "quote": "your APS certificate [...] Upload the digitally sealed APS certificate as an unchanged, original file to your MyAssist account.",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Certificate missing creates acquisition step; held not exemption"
  },
  "APS-SA-VISA": {
    "url": "https://saudiarabien.diplo.de/ksa-en/visa-service/study-preparatory-courses-2195208",
    "quote": "high school graduation certificate and, if applicable, Bachelor/Master certificates with detailed transcript of grades [...] request additional documents",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Reviewed checklist omission; not_listed not exemption"
  },
  "DMAT-INTAKE": {
    "url": "https://aps-india.de/dmat/",
    "quote": "summer semester 2027",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Previous qualification/procedure scope; Summer2027 intake"
  },
  "DMAT-TIMING": {
    "url": "https://aps-india.de/dmat/",
    "quote": "before 29 June 2026",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Separate completed online registration OR complete dispatch strictly beforeJune29"
  },
  "DMAT-COMPLETED": {
    "url": "https://aps-india.de/dmat/",
    "quote": "for that completed APS procedure",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Relevant completed procedure and certificate received; not old possession alone"
  },
  "DMAT-PARTNERSHIP": {
    "url": "https://aps-india.de/dmat/",
    "quote": "officially confirmed",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Applicable institutional/coordinator confirmation and group number"
  },
  "DMAT-FIELD-REVIEW": {
    "url": "https://aps-india.de/wp-content/uploads/2026/06/dMAT_India_Affected_Fields_List.pdf",
    "quote": "not exhaustive",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Version1.0 previous-field classification; no guessed title mapping"
  },
  "DMAT-UNAFFECTED": {
    "url": "https://aps-india.de/wp-content/uploads/2026/06/dMAT_India_Affected_Fields_List.pdf",
    "quote": "previous degree",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Reported applicable APS unaffected confirmation"
  },
  "DMAT-SEMESTERS3": {
    "url": "https://aps-india.de/dmat/",
    "quote": "5 semesters",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Actually completed semesters; no years conversion"
  },
  "DMAT-SEMESTERS4": {
    "url": "https://aps-india.de/dmat/",
    "quote": "7 semesters",
    "verifiedAt": "2026-10-07T00:00:00Z",
    "file": "scripts/dmat.rules.ts",
    "applicability": "Actually completed semesters; no years conversion"
  },
  "DMAT-BACHELOR": {
    "url": "https://aps-india.de/dmat/",
    "quote": "Students applying for Bachelor's programs in Germany are not required to take dMAT.",
    "verifiedAt": "2026-07-04T00:00:00Z",
    "file": "scripts/rules.bootstrap.ts",
    "applicability": "Retained reviewed Bachelor nonrequirement; independent of admission"
  }
};
// Explicit identities distinguish equal URLs (PAK-BV01/02/03, SAU clauses).
export const LOGICAL_SOURCES: Record<string, string> = {
  "gce-technical-subject-restricted": "GCE-DAAD",
  "gce-technical-subject-restricted-cambridge": "GCE-CAMBRIDGE",
  "gce-social-economics-subject-restricted": "GCE-DAAD",
  "gce-social-economics-subject-restricted-cambridge": "GCE-CAMBRIDGE",
  "gce-humanities-subject-restricted": "GCE-DAAD",
  "gce-humanities-subject-restricted-cambridge": "GCE-CAMBRIDGE",
  "gce-science-subject-restricted": "GCE-DAAD",
  "gce-science-subject-restricted-cambridge": "GCE-CAMBRIDGE",
  "gce-medicine-pharmacy-subject-restricted": "GCE-DAAD",
  "gce-medicine-pharmacy-subject-restricted-cambridge": "GCE-CAMBRIDGE",
  "gce-arts-subject-restricted": "GCE-DAAD",
  "gce-arts-subject-restricted-cambridge": "GCE-CAMBRIDGE",
  "ib-reviewed-2025-math-hl-ordinary-grades": "IB-CURRENT-ORDINARY",
  "ib-reviewed-2025-math-sl-annex-ordinary-grades": "IB-CURRENT-ORDINARY",
  "ib-reviewed-2025-math-sl-subject-scope-ordinary-grades": "IB-CURRENT-ORDINARY",
  "ib-reviewed-2025-math-hl-compensated-grade3": "IB-CURRENT-COMPENSATED",
  "ib-reviewed-2025-math-sl-annex-compensated-grade3": "IB-CURRENT-COMPENSATED",
  "ib-reviewed-2025-math-sl-subject-scope-compensated-grade3": "IB-CURRENT-COMPENSATED",
  "ib-reviewed-2021-2024-math-hl-ordinary-grades": "IB-HISTORICAL-ORDINARY",
  "ib-reviewed-2021-2024-math-sl-annex-ordinary-grades": "IB-CURRENT-ORDINARY",
  "ib-reviewed-2021-2024-math-sl-subject-scope-ordinary-grades": "IB-HISTORICAL-ORDINARY",
  "ib-reviewed-2021-2024-math-hl-compensated-grade3": "IB-HISTORICAL-COMPENSATED",
  "ib-reviewed-2021-2024-math-sl-annex-compensated-grade3": "IB-CURRENT-COMPENSATED",
  "ib-reviewed-2021-2024-math-sl-subject-scope-compensated-grade3": "IB-HISTORICAL-COMPENSATED",
  "ib-reviewed-through2020-legacy-mathematics-ordinary-grades": "IB-HISTORICAL-ORDINARY",
  "ib-reviewed-through2020-legacy-mathematics-compensated-grade3": "IB-HISTORICAL-COMPENSATED",
  "ib-reviewed-document-not_awarded": "IB-DOCUMENT",
  "ib-reviewed-document-certificate": "IB-DOCUMENT",
  "ib-reviewed-document-unknown": "IB-DOCUMENT",
  "india-study-successful-year": "INDIA-STUDY",
  "india-study-school-only": "INDIA-STUDY",
  "india-study-review-kind": "INDIA-STUDY",
  "india-study-review-country": "INDIA-STUDY",
  "india-study-review-mode": "INDIA-STUDY",
  "india-study-review-years-missing": "INDIA-STUDY",
  "india-study-review-years-unmet": "INDIA-STUDY",
  "india-study-review-recognition-rejected": "INDIA-STUDY",
  "india-study-review-recognition-missing": "INDIA-STUDY",
  "india-study-review-relation-unrelated": "INDIA-STUDY",
  "india-study-review-relation-missing": "INDIA-STUDY",
  "india-study-review-missing-class12_percent": "INDIA-STUDY",
  "india-study-review-missing-intake_index": "INDIA-STUDY",
  "india-study-review-missing-aps_issuer_country": "INDIA-STUDY",
  "india-study-review-missing-aps_qualification_context": "INDIA-STUDY",
  "in-jee-qualifying-pass-review": "JEE-ORDINARY",
  "pakistan-prep-science": "PK-PREP-SCIENCE",
  "pakistan-prep-commerce": "PK-PREP-COMMERCE",
  "pakistan-prep-humanities": "PK-PREP-HUMANITIES",
  "pakistan-review-completed_qualification": "PK-REVIEW",
  "pakistan-review-other": "PK-REVIEW",
  "pakistan-review-unknown": "PK-REVIEW",
  "pakistan-master-review": "PK-MASTER",
  "pakistan-current-year-science": "PAK-BV03",
  "pakistan-current-year-commerce": "PAK-BV02",
  "pakistan-current-year-humanities": "PAK-BV01",
  "pakistan-current-brochure-science": "PK-BROCHURE",
  "pakistan-current-brochure-commerce": "PK-BROCHURE",
  "pakistan-current-brochure-humanities": "PK-BROCHURE",
  "pakistan-study-evidence-review": "PK-STUDY-REVIEW",
  "sa-reviewed-private-one": "SAU-BV05-ONE",
  "sa-reviewed-private-two": "SAU-BV05-TWO",
  "sa-reviewed-industrial-enrollment": "SAU-INDUSTRIAL-PREP",
  "sa-reviewed-industrial-year": "SAU-BV6",
  "sa-reviewed-national-literary-prep": "SAU-BV01-PREP",
  "sa-reviewed-national-literary-year": "SAU-BV01-YEAR",
  "sa-reviewed-national-science-prep": "SAU-BV02-PREP",
  "sa-reviewed-national-science-year": "SAU-BV02-YEAR",
  "sa-reviewed-national-commercial-prep": "SAU-BV03-PREP",
  "sa-reviewed-national-commercial-year": "SAU-BV03-YEAR",
  "sa-reviewed-completed-bachelor": "SAU-BACHELOR",
  "aps-transition-before": "APS-TRANSITION-BEFORE",
  "aps-transition-unconfirmed": "APS-TRANSITION-BEFORE",
  "aps-transition-current": "APS-TRANSITION-CURRENT",
  "aps-scoped-qualification": "APS-QUALIFICATION",
  "aps-scoped-application": "APS-APPLICATION",
  "aps-scoped-acquisition": "APS-ACQUISITION",
  "aps-scoped-visa-sa": "APS-SA-VISA",
  "dmat-bachelor-not-required": "DMAT-BACHELOR",
  "dmat-reviewed-before-intake": "DMAT-INTAKE",
  "dmat-reviewed-review": "DMAT-INTAKE",
  "dmat-reviewed-multiple-review": "DMAT-FIELD-REVIEW",
  "dmat-reviewed-completed": "DMAT-COMPLETED",
  "dmat-reviewed-registration-before": "DMAT-TIMING",
  "dmat-reviewed-dispatch-before": "DMAT-TIMING",
  "dmat-reviewed-partnership": "DMAT-PARTNERSHIP",
  "dmat-reviewed-unaffected": "DMAT-UNAFFECTED",
  "dmat-reviewed-enrolled-3": "DMAT-SEMESTERS3",
  "dmat-reviewed-enrolled-4": "DMAT-SEMESTERS4",
  "dmat-reviewed-required-0-0-0-0": "DMAT-INTAKE",
  "dmat-reviewed-required-0-0-0-1": "DMAT-INTAKE",
  "dmat-reviewed-required-0-0-1-0": "DMAT-INTAKE",
  "dmat-reviewed-required-0-0-1-1": "DMAT-INTAKE",
  "dmat-reviewed-required-0-0-2-0": "DMAT-INTAKE",
  "dmat-reviewed-required-0-0-2-1": "DMAT-INTAKE",
  "dmat-reviewed-required-0-1-0-0": "DMAT-INTAKE",
  "dmat-reviewed-required-0-1-0-1": "DMAT-INTAKE",
  "dmat-reviewed-required-0-1-1-0": "DMAT-INTAKE",
  "dmat-reviewed-required-0-1-1-1": "DMAT-INTAKE",
  "dmat-reviewed-required-0-1-2-0": "DMAT-INTAKE",
  "dmat-reviewed-required-0-1-2-1": "DMAT-INTAKE",
  "dmat-reviewed-required-1-0-0-0": "DMAT-INTAKE",
  "dmat-reviewed-required-1-0-0-1": "DMAT-INTAKE",
  "dmat-reviewed-required-1-0-1-0": "DMAT-INTAKE",
  "dmat-reviewed-required-1-0-1-1": "DMAT-INTAKE",
  "dmat-reviewed-required-1-0-2-0": "DMAT-INTAKE",
  "dmat-reviewed-required-1-0-2-1": "DMAT-INTAKE",
  "dmat-reviewed-required-1-1-0-0": "DMAT-INTAKE",
  "dmat-reviewed-required-1-1-0-1": "DMAT-INTAKE",
  "dmat-reviewed-required-1-1-1-0": "DMAT-INTAKE",
  "dmat-reviewed-required-1-1-1-1": "DMAT-INTAKE",
  "dmat-reviewed-required-1-1-2-0": "DMAT-INTAKE",
  "dmat-reviewed-required-1-1-2-1": "DMAT-INTAKE"
};

// Fixed selection universes; selected sources are not winning/candidate citations.
export const UNIVERSE_LOGICAL_IDS = {
  "GCE": [
    "gce-technical-subject-restricted",
    "gce-technical-subject-restricted-cambridge",
    "gce-social-economics-subject-restricted",
    "gce-social-economics-subject-restricted-cambridge",
    "gce-humanities-subject-restricted",
    "gce-humanities-subject-restricted-cambridge",
    "gce-science-subject-restricted",
    "gce-science-subject-restricted-cambridge",
    "gce-medicine-pharmacy-subject-restricted",
    "gce-medicine-pharmacy-subject-restricted-cambridge",
    "gce-arts-subject-restricted",
    "gce-arts-subject-restricted-cambridge"
  ],
  "IB": [
    "ib-reviewed-2025-math-hl-ordinary-grades",
    "ib-reviewed-2025-math-sl-annex-ordinary-grades",
    "ib-reviewed-2025-math-sl-subject-scope-ordinary-grades",
    "ib-reviewed-2025-math-hl-compensated-grade3",
    "ib-reviewed-2025-math-sl-annex-compensated-grade3",
    "ib-reviewed-2025-math-sl-subject-scope-compensated-grade3",
    "ib-reviewed-2021-2024-math-hl-ordinary-grades",
    "ib-reviewed-2021-2024-math-sl-annex-ordinary-grades",
    "ib-reviewed-2021-2024-math-sl-subject-scope-ordinary-grades",
    "ib-reviewed-2021-2024-math-hl-compensated-grade3",
    "ib-reviewed-2021-2024-math-sl-annex-compensated-grade3",
    "ib-reviewed-2021-2024-math-sl-subject-scope-compensated-grade3",
    "ib-reviewed-through2020-legacy-mathematics-ordinary-grades",
    "ib-reviewed-through2020-legacy-mathematics-compensated-grade3",
    "ib-reviewed-document-not_awarded",
    "ib-reviewed-document-certificate",
    "ib-reviewed-document-unknown"
  ],
  "India": [
    "df155c8a-8522-459b-b572-51033b93492d",
    "8d95fa83-385f-4863-88cc-7dfe0a3036c6",
    "f787cf74-25be-48db-b20f-2382d4baeb83",
    "c29d930a-87c9-49ba-8e30-b764e42760ca",
    "1cb0cf24-8f39-44b4-b692-b9cb164e47fd",
    "0e872b82-e7fb-41bb-9a35-53ecbe200df4",
    "india-study-successful-year",
    "india-study-school-only",
    "india-study-review-kind",
    "india-study-review-country",
    "india-study-review-mode",
    "india-study-review-years-missing",
    "india-study-review-years-unmet",
    "india-study-review-recognition-rejected",
    "india-study-review-recognition-missing",
    "india-study-review-relation-unrelated",
    "india-study-review-relation-missing",
    "india-study-review-missing-class12_percent",
    "india-study-review-missing-intake_index",
    "india-study-review-missing-aps_issuer_country",
    "india-study-review-missing-aps_qualification_context",
    "aps-transition-before",
    "aps-transition-current",
    "aps-transition-unconfirmed",
    "aps-scoped-qualification",
    "aps-scoped-application",
    "aps-scoped-visa-sa",
    "aps-scoped-acquisition"
  ],
  "JEE": [
    "in-jee-qualifying-pass-review"
  ],
  "Pakistan": [
    "pakistan-prep-science",
    "pakistan-prep-commerce",
    "pakistan-prep-humanities",
    "pakistan-review-completed_qualification",
    "pakistan-review-other",
    "pakistan-review-unknown",
    "pakistan-master-review",
    "pakistan-current-year-science",
    "pakistan-current-brochure-science",
    "pakistan-current-year-commerce",
    "pakistan-current-brochure-commerce",
    "pakistan-current-year-humanities",
    "pakistan-current-brochure-humanities",
    "pakistan-study-evidence-review"
  ],
  "Saudi": [
    "sa-reviewed-private-one",
    "sa-reviewed-private-two",
    "sa-reviewed-industrial-enrollment",
    "sa-reviewed-industrial-year",
    "sa-reviewed-national-literary-prep",
    "sa-reviewed-national-literary-year",
    "sa-reviewed-national-science-prep",
    "sa-reviewed-national-science-year",
    "sa-reviewed-national-commercial-prep",
    "sa-reviewed-national-commercial-year",
    "sa-reviewed-completed-bachelor"
  ],
  "APS": [
    "aps-scoped-qualification",
    "aps-scoped-application",
    "aps-scoped-visa-sa",
    "aps-scoped-acquisition"
  ],
  "transition": [
    "aps-transition-before",
    "aps-transition-current",
    "aps-transition-unconfirmed"
  ],
  "dMAT": [
    "dmat-reviewed-before-intake",
    "dmat-reviewed-review",
    "dmat-reviewed-multiple-review",
    "dmat-reviewed-completed",
    "dmat-reviewed-registration-before",
    "dmat-reviewed-dispatch-before",
    "dmat-reviewed-partnership",
    "dmat-reviewed-unaffected",
    "dmat-reviewed-enrolled-3",
    "dmat-reviewed-enrolled-4",
    "dmat-reviewed-required-0-0-0-0",
    "dmat-reviewed-required-0-0-0-1",
    "dmat-reviewed-required-0-0-1-0",
    "dmat-reviewed-required-0-0-1-1",
    "dmat-reviewed-required-0-0-2-0",
    "dmat-reviewed-required-0-0-2-1",
    "dmat-reviewed-required-0-1-0-0",
    "dmat-reviewed-required-0-1-0-1",
    "dmat-reviewed-required-0-1-1-0",
    "dmat-reviewed-required-0-1-1-1",
    "dmat-reviewed-required-0-1-2-0",
    "dmat-reviewed-required-0-1-2-1",
    "dmat-reviewed-required-1-0-0-0",
    "dmat-reviewed-required-1-0-0-1",
    "dmat-reviewed-required-1-0-1-0",
    "dmat-reviewed-required-1-0-1-1",
    "dmat-reviewed-required-1-0-2-0",
    "dmat-reviewed-required-1-0-2-1",
    "dmat-reviewed-required-1-1-0-0",
    "dmat-reviewed-required-1-1-0-1",
    "dmat-reviewed-required-1-1-1-0",
    "dmat-reviewed-required-1-1-1-1",
    "dmat-reviewed-required-1-1-2-0",
    "dmat-reviewed-required-1-1-2-1",
    "dmat-bachelor-not-required"
  ]
} as const;

// Retained historical evidence only; does not certify old JEE/transition rules.
export const LEGACY_SOURCES: Record<string, {url: string; quote: string; verifiedAt: string}> = {
  "df155c8a-8522-459b-b572-51033b93492d": {
    "url": "https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/",
    "quote": "the sole exception is a valid JEE Advanced result (→ direct, subject-specific)",
    "verifiedAt": "2026-07-04T00:00:00+00:00"
  },
  "8d95fa83-385f-4863-88cc-7dfe0a3036c6": {
    "url": "https://aps-india.de/news/",
    "quote": "From Winter Semester 2026/27, Class XII plus APS may qualify for subject-restricted admission via Studienkolleg when the certificate shows at least 70%.",
    "verifiedAt": "2026-07-04T00:00:00+00:00"
  },
  "f787cf74-25be-48db-b20f-2382d4baeb83": {
    "url": "https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/",
    "quote": "Class 12 from Indian boards → no direct admission; the sole exception is a valid JEE Advanced result (→ direct, subject-specific). Otherwise: Studienkolleg + FSP.",
    "verifiedAt": "2026-07-04T00:00:00+00:00"
  },
  "c29d930a-87c9-49ba-8e30-b764e42760ca": {
    "url": "https://aps-india.de/news/",
    "quote": "anabin criteria updated 15 March 2026; for admissions from Winter Semester 2026/27, minimum 70% overall in Class XII, all boards, applies to BOTH pathways",
    "verifiedAt": "2026-07-04T00:00:00+00:00"
  },
  "1cb0cf24-8f39-44b4-b692-b9cb164e47fd": {
    "url": "https://aps-india.de/news/",
    "quote": "Applications submitted before 15 March 2026 are assessed based on the criteria applicable at the time of submission; already-issued APS certificates remain valid.",
    "verifiedAt": "2026-07-04T00:00:00+00:00"
  },
  "0e872b82-e7fb-41bb-9a35-53ecbe200df4": {
    "url": "https://aps-india.de/news/",
    "quote": "direct subject-restricted admission after ≥1 completed academic year of a recognized Bachelor's — both conditions required",
    "verifiedAt": "2026-07-04T00:00:00+00:00"
  }
};

// Fixed candidate-only academic universes, separate from selected/document/process sources.
export const IB_ACADEMIC_CANDIDATES = [
 'ib-reviewed-2025-math-hl-ordinary-grades','ib-reviewed-2025-math-sl-annex-ordinary-grades','ib-reviewed-2025-math-sl-subject-scope-ordinary-grades',
 'ib-reviewed-2025-math-hl-compensated-grade3','ib-reviewed-2025-math-sl-annex-compensated-grade3','ib-reviewed-2025-math-sl-subject-scope-compensated-grade3',
 'ib-reviewed-2021-2024-math-hl-ordinary-grades','ib-reviewed-2021-2024-math-sl-annex-ordinary-grades','ib-reviewed-2021-2024-math-sl-subject-scope-ordinary-grades',
 'ib-reviewed-2021-2024-math-hl-compensated-grade3','ib-reviewed-2021-2024-math-sl-annex-compensated-grade3','ib-reviewed-2021-2024-math-sl-subject-scope-compensated-grade3',
 'ib-reviewed-through2020-legacy-mathematics-ordinary-grades','ib-reviewed-through2020-legacy-mathematics-compensated-grade3',
];
// Matched unknown review notes are sourced holds, never established academic winners.
export const UNKNOWN_REVIEW_PATH_IDS = [
 'india-study-review-kind','india-study-review-country','india-study-review-years-unmet','india-study-review-years-missing','india-study-review-mode',
 'india-study-review-recognition-rejected','india-study-review-recognition-missing','india-study-review-relation-unrelated','india-study-review-relation-missing',
 'india-study-review-missing-class12_percent','india-study-review-missing-intake_index','india-study-review-missing-aps_issuer_country','india-study-review-missing-aps_qualification_context',
 'pakistan-review-completed_qualification','pakistan-review-other','pakistan-review-unknown','pakistan-master-review','pakistan-study-evidence-review',
 'ib-reviewed-document-not_awarded','ib-reviewed-document-certificate','ib-reviewed-document-unknown',
 'aps-transition-before','aps-transition-unconfirmed',
];

// Root/expert adjudication2: exact matched unknown review IDs for each applicable row.
// Other unknown rows have no matched path review source; this is not a matcher.
export const UNKNOWN_REVIEW_PATH_SOURCES: Record<string, Record<string, string[]>> = {
  "India": {
    "unmet-years-0": [
      "india-study-review-years-unmet"
    ],
    "unmet-years-0.5": [
      "india-study-review-years-unmet"
    ],
    "unmet-years-0.99": [
      "india-study-review-years-unmet"
    ],
    "completed-degree-years-missing": [
      "india-study-review-years-missing"
    ],
    "recognition-rejected": [
      "india-study-review-recognition-rejected"
    ],
    "recognition-unknown": [
      "india-study-review-recognition-missing"
    ],
    "recognition-reference-missing": [
      "india-study-review-recognition-missing"
    ],
    "recognition-reference-blank": [
      "india-study-review-recognition-missing"
    ],
    "same-name-no-assessment": [
      "india-study-review-recognition-missing"
    ],
    "unrelated-target": [
      "india-study-review-relation-unrelated"
    ],
    "target-unknown": [
      "india-study-review-relation-missing"
    ],
    "target-reference-missing": [
      "india-study-review-relation-missing"
    ],
    "same-field-no-assessment": [
      "india-study-review-relation-missing"
    ],
    "mode-distance_online": [
      "india-study-review-mode"
    ],
    "mode-other": [
      "india-study-review-mode"
    ],
    "mode-unknown": [
      "india-study-review-mode"
    ],
    "qualification-diploma": [
      "india-study-review-kind"
    ],
    "qualification-master": [
      "india-study-review-kind"
    ],
    "qualification-other": [
      "india-study-review-kind"
    ],
    "country-pk": [
      "india-study-review-country"
    ],
    "country-undefined": [
      "india-study-review-country"
    ],
    "country-other": [
      "india-study-review-country"
    ],
    "prior-study-missing": [
      "india-study-review-kind"
    ],
    "India-school-only-missing": [],
    "India-school-timing-hold": [
      "aps-transition-before"
    ]
  },
  "Pakistan": {
    "PK-current-part-time": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-distance": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-regulations-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-records-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-success-reference-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-success-reference-blank": [
      "pakistan-review-unknown"
    ],
    "PK-current-recognition-rejected": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-recognition-reference-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-unrelated": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-relation-reference-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-contrary-assessment": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-assessment-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-assessment-reference-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-old-evidence": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-years-0": [
      "pakistan-study-evidence-review"
    ],
    "PK-current-years-0.5": [
      "pakistan-study-evidence-review"
    ],
    "PK-history-completed": [
      "pakistan-review-completed_qualification"
    ],
    "PK-history-discontinued": [
      "pakistan-study-evidence-review"
    ],
    "PK-history-foreign": [
      "pakistan-study-evidence-review"
    ],
    "PK-history-country-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-history-years-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-history-master": [
      "pakistan-review-other"
    ],
    "PK-history-institution-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-history-field-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-intake-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-intake-historical": [
      "pakistan-study-evidence-review"
    ],
    "PK-intake-outside": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-alias-fsc": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-alias-fa": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-alias-icom": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-alias-ics": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-alias-ssc": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-group-mixed": [
      "pakistan-study-evidence-review"
    ],
    "PK-school-incomplete": [
      "pakistan-study-evidence-review"
    ],
    "PK-science-grade-below": [
      "pakistan-study-evidence-review"
    ],
    "PK-science-grade-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-commerce-grade-below": [
      "pakistan-study-evidence-review"
    ],
    "PK-commerce-grade-missing": [
      "pakistan-study-evidence-review"
    ],
    "PK-humanities-grade-below": [
      "pakistan-study-evidence-review"
    ],
    "PK-humanities-grade-missing": [
      "pakistan-study-evidence-review"
    ]
  },
  "IB": {
    "not_awarded": [
      "ib-reviewed-document-not_awarded"
    ],
    "certificate": [
      "ib-reviewed-document-certificate"
    ],
    "unknown": [
      "ib-reviewed-document-unknown"
    ]
  },
  "transition": {
    "APS-submission-2026-03-14": [
      "aps-transition-before"
    ],
    "APS-confirmation-missing": [
      "aps-transition-unconfirmed"
    ],
    "APS-date-missing": [
      "aps-transition-unconfirmed"
    ],
    "APS-intake-missing": [],
    "APS-other-qualification": [],
    "APS-grade-70": [],
    "APS-grade-70.01": []
  }
};
