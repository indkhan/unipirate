// Pure mappers: Supabase row (snake_case) -> the camelCase shape the UI uses.
// Kept separate + pure so they can be unit-tested without a live database.

export function mapUniversity(row) {
  return {
    id: row.slug,
    name: row.name,
    short: row.short,
    city: row.city,
    state: row.state,
    portalType: row.portal_label || row.apply_method,
    applyMethod: row.apply_method,
    generalDeadlines: row.general_deadlines,
    semesterContribution: row.semester_contribution,
    daadUrl: row.daad_url,
    blurb: row.blurb,
  };
}

// Courses reference universities by DB id; the UI keys on the uni slug.
// Pass a map of { universityDbId: slug } to resolve the FK back to a slug.
export function mapCourse(row, slugByUniId = {}) {
  return {
    id: row.slug,
    dbId: row.id,
    universityId: slugByUniId[row.university_id] ?? row.university_id,
    name: row.name,
    degree: row.degree,
    semester: row.semester,
    language: row.language,
    ncFree: row.nc_free,
    ncValue: row.nc_value_label ?? (row.nc_value != null ? String(row.nc_value) : null),
    ncValueNum: row.nc_value,
    ncYear: row.nc_year,
    admissionRequirements: row.admission_requirements,
    languageRequirements: row.language_requirements,
    courseStructure: row.course_structure,
    howToApply: row.how_to_apply,
    applicationDeadline: row.application_deadline,
    keywords: row.keywords || [],
    applyUrl: row.apply_url,
    summary: row.summary,
  };
}
