// Schema types for supabase-js. Hand-written to match
// supabase/migrations/20260704094923_init_core_schema.sql in the shape
// `supabase gen types typescript` emits; regenerate with `pnpm db:types`
// once the project is linked and verify the diff is empty.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      countries: {
        Row: {
          code: string;
          name: string;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          created_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      qualifications: {
        Row: {
          id: string;
          country_code: string | null;
          level: Database["public"]["Enums"]["qualification_level"];
          board_or_type: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          country_code?: string | null;
          level: Database["public"]["Enums"]["qualification_level"];
          board_or_type: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          country_code?: string | null;
          level?: Database["public"]["Enums"]["qualification_level"];
          board_or_type?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualifications_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      rules: {
        Row: {
          id: string;
          conditions: Json;
          outcomes: Json;
          status: Database["public"]["Enums"]["rule_status"];
          source_url: string;
          source_quote: string;
          last_verified_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conditions: Json;
          outcomes: Json;
          status?: Database["public"]["Enums"]["rule_status"];
          source_url: string;
          source_quote: string;
          last_verified_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conditions?: Json;
          outcomes?: Json;
          status?: Database["public"]["Enums"]["rule_status"];
          source_url?: string;
          source_quote?: string;
          last_verified_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      universities: {
        Row: {
          id: string;
          name: string;
          city: string | null;
          uni_assist: boolean;
          website: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city?: string | null;
          uni_assist?: boolean;
          website?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string | null;
          uni_assist?: boolean;
          website?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          university_id: string | null;
          created_by: string | null;
          name: string | null;
          degree: string | null;
          language: string | null;
          tuition: Json | null;
          deadlines: Json | null;
          requirements: Json | null;
          source_url: string;
          normalized_url: string;
          review_status: Database["public"]["Enums"]["course_review_status"];
          extraction_method:
            | Database["public"]["Enums"]["extraction_method"]
            | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id?: string | null;
          created_by?: string | null;
          name?: string | null;
          degree?: string | null;
          language?: string | null;
          tuition?: Json | null;
          deadlines?: Json | null;
          requirements?: Json | null;
          source_url: string;
          normalized_url: string;
          review_status?: Database["public"]["Enums"]["course_review_status"];
          extraction_method?:
            | Database["public"]["Enums"]["extraction_method"]
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string | null;
          created_by?: string | null;
          name?: string | null;
          degree?: string | null;
          language?: string | null;
          tuition?: Json | null;
          deadlines?: Json | null;
          requirements?: Json | null;
          source_url?: string;
          normalized_url?: string;
          review_status?: Database["public"]["Enums"]["course_review_status"];
          extraction_method?:
            | Database["public"]["Enums"]["extraction_method"]
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          user_id: string;
          country_code: string | null;
          answers: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          country_code?: string | null;
          answers?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          country_code?: string | null;
          answers?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          title: string;
          due_date: string | null;
          done: boolean;
          generated_from_rule_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id?: string | null;
          title: string;
          due_date?: string | null;
          done?: boolean;
          generated_from_rule_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string | null;
          title?: string;
          due_date?: string | null;
          done?: boolean;
          generated_from_rule_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_generated_from_rule_id_fkey";
            columns: ["generated_from_rule_id"];
            isOneToOne: false;
            referencedRelation: "rules";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_reports: {
        Row: {
          id: string;
          rule_id: string;
          user_id: string | null;
          message: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          user_id?: string | null;
          message: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          user_id?: string | null;
          message?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_reports_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "rules";
            referencedColumns: ["id"];
          },
        ];
      };
      answer_reports: {
        Row: {
          id: string;
          user_id: string | null;
          message: string;
          context: Json | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          message: string;
          context?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          message?: string;
          context?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      rule_status: "draft" | "beta" | "verified";
      course_review_status: "pending" | "approved" | "rejected";
      extraction_method: "library" | "ai" | "manual";
      qualification_level: "school" | "bachelor" | "master";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
