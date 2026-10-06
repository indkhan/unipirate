// Hand-authored additive contracts, NOT generated Supabase output.
// Replace this extension with locally generated database.types.ts after the
// orchestrator applies the migration to its disposable schema.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";
import type { Programme, CourseOffering, OfferingVersion } from "@/lib/courses/offerings";
type RecordTable<T> = { Row: T & { id: string; created_at: string }; Insert: T; Update: never; Relationships: [] };
export type CourseCatalogueDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      programmes: Omit<RecordTable<Programme>, "Update"> & { Update: Partial<Programme> };
      course_offerings: RecordTable<Omit<CourseOffering, "applicability"> & { applicability: Json }>;
      course_offering_versions: RecordTable<Omit<OfferingVersion, "facts"> & { facts: Json }>;
    };
  };
};
export type CourseCatalogueDb = Pick<SupabaseClient<CourseCatalogueDatabase>, "from">;
