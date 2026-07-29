export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
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
          new_row: Json
          new_status: string | null
          old_row: Json
          old_status: string | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_row: Json
          new_status?: string | null
          old_row: Json
          old_status?: string | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json
          new_status?: string | null
          old_row?: Json
          old_status?: string | null
          row_id?: string
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
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          course_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          notes?: string | null
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
          answers: Json | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          owner_token_hash: string | null
          profile: Json
          result: Json
        }
        Insert: {
          answers?: Json | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          owner_token_hash?: string | null
          profile: Json
          result: Json
        }
        Update: {
          answers?: Json | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          owner_token_hash?: string | null
          profile?: Json
          result?: Json
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
        }
        Relationships: []
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
          revision: number
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
          revision?: number
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
          revision?: number
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
      course_task_source_reviews: {
        Row: {
          candidate_key: string
          change_type: Database["public"]["Enums"]["course_task_source_change"]
          course_id: string
          course_task_definition_id: string | null
          created_at: string
          id: string
          new_snapshot: Json | null
          old_snapshot: Json | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["course_task_source_review_status"]
        }
        Insert: {
          candidate_key: string
          change_type: Database["public"]["Enums"]["course_task_source_change"]
          course_id: string
          course_task_definition_id?: string | null
          created_at?: string
          id?: string
          new_snapshot?: Json | null
          old_snapshot?: Json | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["course_task_source_review_status"]
        }
        Update: {
          candidate_key?: string
          change_type?: Database["public"]["Enums"]["course_task_source_change"]
          course_id?: string
          course_task_definition_id?: string | null
          created_at?: string
          id?: string
          new_snapshot?: Json | null
          old_snapshot?: Json | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["course_task_source_review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "course_task_source_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_task_source_reviews_course_task_definition_id_fkey"
            columns: ["course_task_definition_id"]
            isOneToOne: false
            referencedRelation: "course_task_definitions"
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
            foreignKeyName: "kb_chunks_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
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
          country_code: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          country_code?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          country_code?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      qualifications: {
        Row: {
          board_or_type: string
          country_code: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["qualification_level"]
          notes: string | null
        }
        Insert: {
          board_or_type: string
          country_code?: string | null
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["qualification_level"]
          notes?: string | null
        }
        Update: {
          board_or_type?: string
          country_code?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["qualification_level"]
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
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
        Relationships: [
          {
            foreignKeyName: "rules_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      tasks: {
        Row: {
          admin_change_state: Database["public"]["Enums"]["course_task_change_state"]
          admin_snapshot: Json | null
          application_id: string | null
          course_task_definition_id: string | null
          created_at: string
          definition_revision: number | null
          description: string | null
          done: boolean
          due_date: string | null
          generated_active: boolean
          generated_from_rule_id: string | null
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
          definition_revision?: number | null
          description?: string | null
          done?: boolean
          due_date?: string | null
          generated_active?: boolean
          generated_from_rule_id?: string | null
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
          definition_revision?: number | null
          description?: string | null
          done?: boolean
          due_date?: string | null
          generated_active?: boolean
          generated_from_rule_id?: string | null
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
          {
            foreignKeyName: "tasks_generated_from_rule_id_fkey"
            columns: ["generated_from_rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
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
      remove_my_course: { Args: { course_id: string }; Returns: undefined }
      resolve_course_conflict: {
        Args: { p_keep_new: boolean; p_new_course_id: string }
        Returns: undefined
      }
      result_viewer: {
        Args: { p_check_id: string; p_token_hash?: string }
        Returns: string
      }
    }
    Enums: {
      course_review_status: "pending" | "approved" | "rejected"
      course_task_change_state: "current" | "update_pending" | "removal_pending"
      course_task_due_mode: "source_deadline" | "fixed_date" | "none"
      course_task_kind: "submission" | "requirement" | "custom"
      course_task_source_change: "changed" | "new" | "removed"
      course_task_source_review_status: "pending" | "adopted" | "kept"
      extraction_method: "library" | "ai" | "manual"
      qualification_level: "school" | "bachelor" | "master"
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
      course_review_status: ["pending", "approved", "rejected"],
      course_task_change_state: [
        "current",
        "update_pending",
        "removal_pending",
      ],
      course_task_due_mode: ["source_deadline", "fixed_date", "none"],
      course_task_kind: ["submission", "requirement", "custom"],
      course_task_source_change: ["changed", "new", "removed"],
      course_task_source_review_status: ["pending", "adopted", "kept"],
      extraction_method: ["library", "ai", "manual"],
      qualification_level: ["school", "bachelor", "master"],
      rule_status: ["draft", "beta", "verified"],
    },
  },
} as const
