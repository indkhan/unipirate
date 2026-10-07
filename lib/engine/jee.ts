// Applicant reports only. No score/rank conversion or German exception inference.
import { z } from 'zod';
export const JEE_LEGACY_SLUG = "in-jee-advanced-direct";
export const JEE_SOURCE = 'https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/';
export const JEE_FIELD_SOURCE = 'https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/';
export const JeeStatusSchema = z.enum(['passed','not_passed','no_result','unknown']);
export const JeeContextSchema = z.enum(['ordinary','main_exemption','preparatory_rank','cross_year','unclear']);
export const JeeProfileSchema = z.object({main:JeeStatusSchema.optional(),advanced:JeeStatusSchema.optional(),context:JeeContextSchema.optional()}).strict();
export type JeeProfile = z.infer<typeof JeeProfileSchema>;
