// UP-ELIG-08: applicant reports only. Zero I/O; policy thresholds stay in rules.
import { z } from 'zod';
import type { Profile } from './evaluate';
export const PK_CERTIFICATES = ['hssc', 'intermediate', 'ssc', 'fsc', 'fa', 'icom', 'ics', 'other', 'unknown'] as const;
export const PK_GROUPS = ['science', 'commerce', 'humanities', 'mixed', 'other', 'unknown'] as const;
export const PK_FAMILIES = ['medicine', 'natural_sciences', 'technology', 'social_sciences', 'economics', 'humanities', 'other', 'unknown'] as const;
const reference = z.string().trim().min(1).max(500);
export const PakistanProfileSchema = z.object({
    version: z.literal(1), certificate: z.enum(PK_CERTIFICATES).optional(), group: z.enum(PK_GROUPS).optional(),
    completion: z.enum(['completed_12_grades', 'incomplete', 'unknown']).optional(),
    targetFamily: z.enum(PK_FAMILIES).optional(), targetFamilyReference: reference.optional(),
}).strict();
export type PakistanProfile = z.infer<typeof PakistanProfileSchema>;
export const PakistanStudySchema = z.object({
    mode: z.enum(['full_time', 'part_time', 'distance_online', 'other', 'unknown']).optional(),
    regulations: z.enum(['confirmed', 'not_confirmed', 'unknown']).optional(),
    annualRecords: z.enum(['confirmed', 'not_available', 'unknown']).optional(),
    successfulYearsReference: reference.optional(),
    recognition: z.enum(['reported_official_confirmed', 'reported_official_rejected', 'unknown']).optional(), recognitionReference: reference.optional(),
    relation: z.enum(['reported_official_previous', 'reported_official_closely_related', 'reported_official_unrelated', 'unknown']).optional(), relationReference: reference.optional(),
}).strict();
export type PakistanStudy = z.infer<typeof PakistanStudySchema>;
export const PK_FACT_KEYS = ['pk_certificate', 'pk_documentary_group', 'pk_school_completion', 'pk_grade_percent', 'pk_prior_study_kind', 'pk_prior_study_country', 'pk_prior_study_completion', 'pk_successful_academic_years', 'pk_study_mode', 'pk_study_regulations', 'pk_annual_records', 'pk_reported_recognition', 'pk_reported_target_relation', 'pk_target_family'] as const;
const PakistanHistorySchema = z.object({
    hasPriorUniversityStudy: z.boolean(), qualificationType: z.enum(['bachelor', 'master', 'diploma', 'other']).optional(),
    institution: z.string().trim().min(1).max(200).optional(), country: z.string().regex(/^(?:[a-z]{2}|other|unknown)$/).optional(),
    field: z.string().trim().min(1).max(200).optional(), degreeYears: z.number().finite().min(0).max(50).optional(), completedYears: z.number().finite().min(0).max(50).optional(),
    completion: z.enum(['completed', 'in_progress', 'discontinued']).optional(), pakistanStudy: PakistanStudySchema.optional(),
}).passthrough();
export function derivePakistanFacts(p: Profile): Record<string, string | number | boolean> {
    if (p.targetDegree !== 'bachelor' || p.curriculumType !== 'national' || p.schoolQualification?.country !== 'pk' || p.schoolQualification.context !== 'national')
        return {};
    const parsed = PakistanProfileSchema.safeParse(p.pakistan);
    if (!parsed.success)
        return {};
    const s = parsed.data, history = PakistanHistorySchema.safeParse(p.qualificationHistory), h = history.success ? history.data : undefined;
    const facts: Record<string, string | number | boolean> = { pk_certificate: s.certificate ?? 'unknown', pk_documentary_group: s.group ?? 'unknown', pk_school_completion: s.completion ?? 'unknown', pk_prior_study_kind: h?.hasPriorUniversityStudy === false ? 'none' : h?.hasPriorUniversityStudy === true ? h.completion === 'completed' ? 'completed_qualification' : h.qualificationType === 'bachelor' ? 'bachelor' : 'other' : 'unknown', pk_prior_study_country: h?.country ?? 'unknown', pk_prior_study_completion: h?.completion ?? 'unknown', pk_target_family: s.targetFamilyReference && p.targetField?.trim() ? s.targetFamily ?? 'unknown' : 'unknown' };
    if (typeof p.schoolGradePercent === 'number' && Number.isFinite(p.schoolGradePercent) && p.schoolGradePercent >= 0 && p.schoolGradePercent <= 100)
        facts.pk_grade_percent = p.schoolGradePercent;
    const study = PakistanStudySchema.safeParse(h?.pakistanStudy);
    if (h?.hasPriorUniversityStudy && study.success) {
        const e = study.data;
        facts.pk_study_mode = e.mode ?? 'unknown';
        facts.pk_study_regulations = e.regulations ?? 'unknown';
        facts.pk_annual_records = e.annualRecords ?? 'unknown';
        if (e.annualRecords === 'confirmed' && e.successfulYearsReference && typeof h.completedYears === 'number' && Number.isFinite(h.completedYears) && h.completedYears >= 0 && h.completedYears <= 50)
            facts.pk_successful_academic_years = h.completedYears;
        const basis = !!h.institution?.trim() && !!h.field?.trim() && h.qualificationType === 'bachelor';
        facts.pk_reported_recognition = basis && e.recognitionReference ? e.recognition ?? 'unknown' : 'unknown';
        facts.pk_reported_target_relation = basis && p.targetField?.trim() && e.relationReference ? e.relation ?? 'unknown' : 'unknown';
    }
    return facts;
}
