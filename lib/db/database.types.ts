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
        Relationships: [
          {
            foreignKeyName: "checks_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      courses: {
        Row: {
          created_at: string
          created_by: string | null
          deadlines: Json | null
          degree: string | null
          extraction_method:
            | Database["public"]["Enums"]["extraction_method"]
            | null
          id: string
          language: string | null
          name: string | null
          normalized_url: string
          requirements: Json | null
          review_status: Database["public"]["Enums"]["course_review_status"]
          source_url: string
          tuition: Json | null
          university_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadlines?: Json | null
          degree?: string | null
          extraction_method?:
            | Database["public"]["Enums"]["extraction_method"]
            | null
          id?: string
          language?: string | null
          name?: string | null
          normalized_url: string
          requirements?: Json | null
          review_status?: Database["public"]["Enums"]["course_review_status"]
          source_url: string
          tuition?: Json | null
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadlines?: Json | null
          degree?: string | null
          extraction_method?:
            | Database["public"]["Enums"]["extraction_method"]
            | null
          id?: string
          language?: string | null
          name?: string | null
          normalized_url?: string
          requirements?: Json | null
          review_status?: Database["public"]["Enums"]["course_review_status"]
          source_url?: string
          tuition?: Json | null
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
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
      rule_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          rule_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          rule_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          rule_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_reports_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
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
          application_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          generated_from_rule_id: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          generated_from_rule_id?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          generated_from_rule_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "tasks_generated_from_rule_id_fkey"
            columns: ["generated_from_rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          uni_assist: boolean
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          uni_assist?: boolean
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          uni_assist?: boolean
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      course_review_status: "pending" | "approved" | "rejected"
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
      extraction_method: ["library", "ai", "manual"],
      qualification_level: ["school", "bachelor", "master"],
      rule_status: ["draft", "beta", "verified"],
    },
  },
} as const
