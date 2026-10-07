export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_status: string | null
          old_status: string | null
          programme_correction: Json | null
          row_id: string
          rule_publication: Json | null
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          programme_correction?: Json | null
          row_id: string
          rule_publication?: Json | null
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          programme_correction?: Json | null
          row_id?: string
          rule_publication?: Json | null
          table_name?: string
        }
        Relationships: []
      }
      answer_reports: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          course_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      checks: {
        Row: {
          answers: Json
          assessment_metadata: Json | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          owner_token_hash: string | null
          result: Json
        }
        Insert: {
          answers: Json
          assessment_metadata?: Json | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          owner_token_hash?: string | null
          result: Json
        }
        Update: {
          answers?: Json
          assessment_metadata?: Json | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          owner_token_hash?: string | null
          result?: Json
        }
        Relationships: []
      }
      course_offering_versions: {
        Row: {
          created_at: string
          facts: Json
          id: string
          offering_id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          facts?: Json
          id?: string
          offering_id: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          facts?: Json
          id?: string
          offering_id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_offering_versions_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      course_offerings: {
        Row: {
          applicability: Json
          applicant_group: string
          created_at: string
          id: string
          intake_term: string
          intake_year: number
          programme_id: string
        }
        Insert: {
          applicability: Json
          applicant_group: string
          created_at?: string
          id?: string
          intake_term: string
          intake_year: number
          programme_id: string
        }
        Update: {
          applicability?: Json
          applicant_group?: string
          created_at?: string
          id?: string
          intake_term?: string
          intake_year?: number
          programme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_offerings_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      course_task_definitions: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          due_date: string | null
          due_mode: Database["public"]["Enums"]["course_task_due_mode"]
          id: string
          kind: Database["public"]["Enums"]["course_task_kind"]
          retired_at: string | null
          sort_order: number
          source_key: string | null
          source_snapshot: Json | null
          source_url: string | null
          title_template: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_mode?: Database["public"]["Enums"]["course_task_due_mode"]
          id?: string
          kind: Database["public"]["Enums"]["course_task_kind"]
          retired_at?: string | null
          sort_order?: number
          source_key?: string | null
          source_snapshot?: Json | null
          source_url?: string | null
          title_template: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_mode?: Database["public"]["Enums"]["course_task_due_mode"]
          id?: string
          kind?: Database["public"]["Enums"]["course_task_kind"]
          retired_at?: string | null
          sort_order?: number
          source_key?: string | null
          source_snapshot?: Json | null
          source_url?: string | null
          title_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_task_definitions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          conflicts_with: string | null
          created_at: string
          deadlines: Json | null
          degree: string | null
          description: string | null
          extraction_method:
            | Database["public"]["Enums"]["extraction_method"]
            | null
          field_extraction: Json | null
          id: string
          imported_by: string | null
          language: string | null
          location: string | null
          name: string | null
          normalized_url: string
          requirements: Json | null
          review_status: Database["public"]["Enums"]["course_review_status"]
          source_url: string
          tuition: Json | null
          university_name: string | null
          updated_at: string
        }
        Insert: {
          conflicts_with?: string | null
          created_at?: string
          deadlines?: Json | null
          degree?: string | null
          description?: string | null
          extraction_method?:
            | Database["public"]["Enums"]["extraction_method"]
            | null
          field_extraction?: Json | null
          id?: string
          imported_by?: string | null
          language?: string | null
          location?: string | null
          name?: string | null
          normalized_url: string
          requirements?: Json | null
          review_status?: Database["public"]["Enums"]["course_review_status"]
          source_url: string
          tuition?: Json | null
          university_name?: string | null
          updated_at?: string
        }
        Update: {
          conflicts_with?: string | null
          created_at?: string
          deadlines?: Json | null
          degree?: string | null
          description?: string | null
          extraction_method?:
            | Database["public"]["Enums"]["extraction_method"]
            | null
          field_extraction?: Json | null
          id?: string
          imported_by?: string | null
          language?: string | null
          location?: string | null
          name?: string | null
          normalized_url?: string
          requirements?: Json | null
          review_status?: Database["public"]["Enums"]["course_review_status"]
          source_url?: string
          tuition?: Json | null
          university_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_conflicts_with_fkey"
            columns: ["conflicts_with"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          content: string
          country_code: string | null
          created_at: string
          embedding: string | null
          id: string
          last_verified_at: string | null
          rule_id: string | null
          slug: string
          source_type: string
          source_url: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          country_code?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          last_verified_at?: string | null
          rule_id?: string | null
          slug: string
          source_type: string
          source_url: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          country_code?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          last_verified_at?: string | null
          rule_id?: string | null
          slug?: string
          source_type?: string
          source_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          answers: Json
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          created_at: string
          degree: string | null
          id: string
          legacy_course_id: string | null
          name: string
          source_url: string
          university_name: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          id?: string
          legacy_course_id?: string | null
          name: string
          source_url: string
          university_name: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          id?: string
          legacy_course_id?: string | null
          name?: string
          source_url?: string
          university_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_legacy_course_id_fkey"
            columns: ["legacy_course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_drafts: {
        Row: {
          edited_at: string
          edited_by: string | null
          effective_from: string | null
          effective_until: string | null
          intake_from: number | null
          intake_until: number | null
          raw_snapshot: Json
          revision: number
          rule_id: string
        }
        Insert: {
          edited_at?: string
          edited_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          intake_from?: number | null
          intake_until?: number | null
          raw_snapshot: Json
          revision?: number
          rule_id: string
        }
        Update: {
          edited_at?: string
          edited_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          intake_from?: number | null
          intake_until?: number | null
          raw_snapshot?: Json
          revision?: number
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_drafts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: true
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_versions: {
        Row: {
          captured_at: string | null
          draft_revision: number | null
          effective_from: string | null
          effective_until: string | null
          id: string
          intake_from: number | null
          intake_until: number | null
          provenance: string
          published_at: string | null
          raw_snapshot: Json
          reviewed_at: string | null
          reviewed_by: string | null
          rule_id: string
          status: Database["public"]["Enums"]["rule_status"]
          supersedes_version_id: string | null
          version_number: number
        }
        Insert: {
          captured_at?: string | null
          draft_revision?: number | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          intake_from?: number | null
          intake_until?: number | null
          provenance: string
          published_at?: string | null
          raw_snapshot: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id: string
          status: Database["public"]["Enums"]["rule_status"]
          supersedes_version_id?: string | null
          version_number: number
        }
        Update: {
          captured_at?: string | null
          draft_revision?: number | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          intake_from?: number | null
          intake_until?: number | null
          provenance?: string
          published_at?: string | null
          raw_snapshot?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id?: string
          status?: Database["public"]["Enums"]["rule_status"]
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_versions_rule_id_supersedes_version_id_fkey"
            columns: ["rule_id", "supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["rule_id", "id"]
          },
        ]
      }
      rules: {
        Row: {
          conditions: Json
          country_code: string | null
          created_at: string
          id: string
          last_verified_at: string | null
          notes: string | null
          outcomes: Json
          slug: string | null
          source_quote: string
          source_url: string
          status: Database["public"]["Enums"]["rule_status"]
          updated_at: string
        }
        Insert: {
          conditions: Json
          country_code?: string | null
          created_at?: string
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          outcomes: Json
          slug?: string | null
          source_quote: string
          source_url: string
          status?: Database["public"]["Enums"]["rule_status"]
          updated_at?: string
        }
        Update: {
          conditions?: Json
          country_code?: string | null
          created_at?: string
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          outcomes?: Json
          slug?: string | null
          source_quote?: string
          source_url?: string
          status?: Database["public"]["Enums"]["rule_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          admin_change_state: Database["public"]["Enums"]["course_task_change_state"]
          admin_snapshot: Json | null
          application_id: string | null
          course_task_definition_id: string | null
          created_at: string
          description: string | null
          done: boolean
          due_date: string | null
          generated_active: boolean
          has_personal_edits: boolean
          id: string
          preferred_bucket: string | null
          sort_order: number
          source_url: string | null
          source_verified_at: string | null
          task_key: string | null
          title: string
          updated_at: string
          user_id: string
          verbatim_due: string | null
        }
        Insert: {
          admin_change_state?: Database["public"]["Enums"]["course_task_change_state"]
          admin_snapshot?: Json | null
          application_id?: string | null
          course_task_definition_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_date?: string | null
          generated_active?: boolean
          has_personal_edits?: boolean
          id?: string
          preferred_bucket?: string | null
          sort_order?: number
          source_url?: string | null
          source_verified_at?: string | null
          task_key?: string | null
          title: string
          updated_at?: string
          user_id: string
          verbatim_due?: string | null
        }
        Update: {
          admin_change_state?: Database["public"]["Enums"]["course_task_change_state"]
          admin_snapshot?: Json | null
          application_id?: string | null
          course_task_definition_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_date?: string | null
          generated_active?: boolean
          has_personal_edits?: boolean
          id?: string
          preferred_bucket?: string | null
          sort_order?: number
          source_url?: string | null
          source_verified_at?: string | null
          task_key?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          verbatim_due?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_course_task_definition_id_fkey"
            columns: ["course_task_definition_id"]
            isOneToOne: false
            referencedRelation: "course_task_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_check: {
        Args: { p_check_id: string; p_token_hash: string }
        Returns: boolean
      }
      get_shared_check: {
        Args: { p_check_id: string }
        Returns: {
          answers: Json
          assessment_metadata: Json
          created_at: string
          id: string
          result: Json
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      match_kb_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          country_code: string
          last_verified_at: string
          similarity: number
          slug: string
          source_type: string
          source_url: string
          title: string
        }[]
      }
      publish_rule_version: {
        Args: {
          p_approval_status: Database["public"]["Enums"]["rule_status"]
          p_expected_draft_revision: number
          p_expected_predecessor_id: string
          p_expected_raw_snapshot: Json
          p_rule_id: string
        }
        Returns: {
          captured_at: string | null
          draft_revision: number | null
          effective_from: string | null
          effective_until: string | null
          id: string
          intake_from: number | null
          intake_until: number | null
          provenance: string
          published_at: string | null
          raw_snapshot: Json
          reviewed_at: string | null
          reviewed_by: string | null
          rule_id: string
          status: Database["public"]["Enums"]["rule_status"]
          supersedes_version_id: string | null
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "rule_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_my_course: { Args: { course_id: string }; Returns: undefined }
      resolve_course_conflict: {
        Args: { p_keep_new: boolean; p_new_course_id: string }
        Returns: undefined
      }
      result_viewer: {
        Args: { p_check_id: string; p_token_hash?: string }
        Returns: string
      }
      valid_check_assessment_metadata: {
        Args: { value: Json }
        Returns: boolean
      }
      valid_course_capture_applicability: {
        Args: { value: Json }
        Returns: boolean
      }
      valid_course_capture_facts: { Args: { facts: Json }; Returns: boolean }
      valid_course_capture_text: { Args: { value: string }; Returns: boolean }
      valid_course_capture_timestamp: {
        Args: { value: string }
        Returns: boolean
      }
      valid_course_source_url: { Args: { value: string }; Returns: boolean }
      valid_offering_applicability: { Args: { value: Json }; Returns: boolean }
      valid_offering_facts: {
        Args: { facts: Json; reviewed: boolean }
        Returns: boolean
      }
      valid_offering_source_urls: { Args: { facts: Json }; Returns: boolean }
      valid_rule_publication_snapshot: {
        Args: { at_time: string; logical_id: string; value: Json }
        Returns: boolean
      }
    }
    Enums: {
      course_application_route:
        | "direct"
        | "uni_assist"
        | "vpd_then_university"
        | "unresolved"
      course_review_status: "pending" | "approved" | "rejected"
      course_task_change_state: "current" | "update_pending" | "removal_pending"
      course_task_due_mode: "source_deadline" | "fixed_date" | "none"
      course_task_kind: "submission" | "requirement" | "custom"
      extraction_method: "library" | "ai" | "manual"
      rule_status: "draft" | "beta" | "verified"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      course_application_route: [
        "direct",
        "uni_assist",
        "vpd_then_university",
        "unresolved",
      ],
      course_review_status: ["pending", "approved", "rejected"],
      course_task_change_state: [
        "current",
        "update_pending",
        "removal_pending",
      ],
      course_task_due_mode: ["source_deadline", "fixed_date", "none"],
      course_task_kind: ["submission", "requirement", "custom"],
      extraction_method: ["library", "ai", "manual"],
      rule_status: ["draft", "beta", "verified"],
    },
  },
} as const

