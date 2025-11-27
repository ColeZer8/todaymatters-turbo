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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          birthdate: string | null
          contact_type: string | null
          created_at: string
          created_by: string | null
          display_name: string
          email: string | null
          id: string
          meta: Json | null
          phone: string | null
          rating: number | null
          source: string | null
          source_id: string | null
          status: string | null
          tags: Json | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          birthdate?: string | null
          contact_type?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          email?: string | null
          id?: string
          meta?: Json | null
          phone?: string | null
          rating?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          birthdate?: string | null
          contact_type?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string | null
          id?: string
          meta?: Json | null
          phone?: string | null
          rating?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_backup"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          attachment_refs: string | null
          attendees: Json | null
          bcc_addresses: string | null
          body_ref: string | null
          categories: Json | null
          cc_addresses: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["direction"] | null
          due_at: string | null
          external_id: string | null
          from_address: string | null
          id: string
          is_read: boolean | null
          is_recurring: boolean | null
          is_starred: boolean | null
          labels: Json | null
          location: string | null
          meta: Json | null
          preview: string | null
          priority: Database["public"]["Enums"]["priority"] | null
          rating: number | null
          read_at: string | null
          received_at: string | null
          recurring_rule: string | null
          replied_at: string | null
          requires_action: boolean | null
          scheduled_end: string | null
          scheduled_start: string | null
          sent_at: string | null
          source_etag: string | null
          source_id: string | null
          source_provider: Database["public"]["Enums"]["provider"] | null
          status: string | null
          subject: string | null
          tags: Json | null
          thread_id: string | null
          title: string | null
          to_addresses: string | null
          type: Database["public"]["Enums"]["event_type"]
          unique: string | null
          updated_at: string
          updated_by: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          attachment_refs?: string | null
          attendees?: Json | null
          bcc_addresses?: string | null
          body_ref?: string | null
          categories?: Json | null
          cc_addresses?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["direction"] | null
          due_at?: string | null
          external_id?: string | null
          from_address?: string | null
          id?: string
          is_read?: boolean | null
          is_recurring?: boolean | null
          is_starred?: boolean | null
          labels?: Json | null
          location?: string | null
          meta?: Json | null
          preview?: string | null
          priority?: Database["public"]["Enums"]["priority"] | null
          rating?: number | null
          read_at?: string | null
          received_at?: string | null
          recurring_rule?: string | null
          replied_at?: string | null
          requires_action?: boolean | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          sent_at?: string | null
          source_etag?: string | null
          source_id?: string | null
          source_provider?: Database["public"]["Enums"]["provider"] | null
          status?: string | null
          subject?: string | null
          tags?: Json | null
          thread_id?: string | null
          title?: string | null
          to_addresses?: string | null
          type: Database["public"]["Enums"]["event_type"]
          unique?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          attachment_refs?: string | null
          attendees?: Json | null
          bcc_addresses?: string | null
          body_ref?: string | null
          categories?: Json | null
          cc_addresses?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["direction"] | null
          due_at?: string | null
          external_id?: string | null
          from_address?: string | null
          id?: string
          is_read?: boolean | null
          is_recurring?: boolean | null
          is_starred?: boolean | null
          labels?: Json | null
          location?: string | null
          meta?: Json | null
          preview?: string | null
          priority?: Database["public"]["Enums"]["priority"] | null
          rating?: number | null
          read_at?: string | null
          received_at?: string | null
          recurring_rule?: string | null
          replied_at?: string | null
          requires_action?: boolean | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          sent_at?: string | null
          source_etag?: string | null
          source_id?: string | null
          source_provider?: Database["public"]["Enums"]["provider"] | null
          status?: string | null
          subject?: string | null
          tags?: Json | null
          thread_id?: string | null
          title?: string | null
          to_addresses?: string | null
          type?: Database["public"]["Enums"]["event_type"]
          unique?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      events_backup: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          attendees: Json | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          is_recurring: boolean | null
          kind: Database["public"]["Enums"]["event_kind"]
          labels: Json | null
          location: string | null
          meta: Json | null
          priority: Database["public"]["Enums"]["priority"] | null
          rating: number | null
          recurrence_parent_id: string | null
          rrule: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          source_etag: string | null
          source_id: string | null
          source_provider: Database["public"]["Enums"]["provider"] | null
          status: string | null
          title: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          attendees?: Json | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_recurring?: boolean | null
          kind: Database["public"]["Enums"]["event_kind"]
          labels?: Json | null
          location?: string | null
          meta?: Json | null
          priority?: Database["public"]["Enums"]["priority"] | null
          rating?: number | null
          recurrence_parent_id?: string | null
          rrule?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          source_etag?: string | null
          source_id?: string | null
          source_provider?: Database["public"]["Enums"]["provider"] | null
          status?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          attendees?: Json | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_recurring?: boolean | null
          kind?: Database["public"]["Enums"]["event_kind"]
          labels?: Json | null
          location?: string | null
          meta?: Json | null
          priority?: Database["public"]["Enums"]["priority"] | null
          rating?: number | null
          recurrence_parent_id?: string | null
          rrule?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          source_etag?: string | null
          source_id?: string | null
          source_provider?: Database["public"]["Enums"]["provider"] | null
          status?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "events_backup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_backup"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ideal_day: {
        Row: {
          calls_minutes: number | null
          category_id: number | null
          created_at: string
          created_by: string | null
          day_type: string | null
          id: string
          minutes: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          calls_minutes?: number | null
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          day_type?: string | null
          id?: string
          minutes?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          calls_minutes?: number | null
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          day_type?: string | null
          id?: string
          minutes?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_children: {
        Row: {
          birthdate: string | null
          child_name: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          birthdate?: string | null
          child_name?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          birthdate?: string | null
          child_name?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_children_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_backup"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profile_values: {
        Row: {
          created_at: string
          id: string
          rank: number | null
          user_id: string
          value_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          rank?: number | null
          user_id: string
          value_label: string
        }
        Update: {
          created_at?: string
          id?: string
          rank?: number | null
          user_id?: string
          value_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_values_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_backup"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          anniversary: string | null
          birthday: string | null
          children_count: number | null
          church_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          data_consent_at: string | null
          emergency_info: string | null
          full_name: string | null
          id: string
          ideal_day_off: string | null
          ideal_sabbath: string | null
          ideal_work_day: string | null
          locale: string | null
          marketing_consent_at: string | null
          mission: string | null
          spouse_birthday: string | null
          spouse_name: string | null
          timezone: string
          tithe_goal: number | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          values_text: string | null
        }
        Insert: {
          anniversary?: string | null
          birthday?: string | null
          children_count?: number | null
          church_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          data_consent_at?: string | null
          emergency_info?: string | null
          full_name?: string | null
          id?: string
          ideal_day_off?: string | null
          ideal_sabbath?: string | null
          ideal_work_day?: string | null
          locale?: string | null
          marketing_consent_at?: string | null
          mission?: string | null
          spouse_birthday?: string | null
          spouse_name?: string | null
          timezone?: string
          tithe_goal?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          values_text?: string | null
        }
        Update: {
          anniversary?: string | null
          birthday?: string | null
          children_count?: number | null
          church_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          data_consent_at?: string | null
          emergency_info?: string | null
          full_name?: string | null
          id?: string
          ideal_day_off?: string | null
          ideal_sabbath?: string | null
          ideal_work_day?: string | null
          locale?: string | null
          marketing_consent_at?: string | null
          mission?: string | null
          spouse_birthday?: string | null
          spouse_name?: string | null
          timezone?: string
          tithe_goal?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          values_text?: string | null
        }
        Relationships: []
      }
      profiles_backup: {
        Row: {
          anniversary: string | null
          birthday: string | null
          children_count: number | null
          church_name: string | null
          country: string | null
          created_at: string
          data_consent_at: string | null
          emergency_info: string | null
          full_name: string | null
          ideal_day_off: string | null
          ideal_sabbath: string | null
          ideal_work_day: string | null
          locale: string | null
          marketing_consent_at: string | null
          mission: string | null
          spouse_birthday: string | null
          spouse_name: string | null
          timezone: string
          tithe_goal: number | null
          updated_at: string
          user_id: string
          values_text: string | null
        }
        Insert: {
          anniversary?: string | null
          birthday?: string | null
          children_count?: number | null
          church_name?: string | null
          country?: string | null
          created_at?: string
          data_consent_at?: string | null
          emergency_info?: string | null
          full_name?: string | null
          ideal_day_off?: string | null
          ideal_sabbath?: string | null
          ideal_work_day?: string | null
          locale?: string | null
          marketing_consent_at?: string | null
          mission?: string | null
          spouse_birthday?: string | null
          spouse_name?: string | null
          timezone?: string
          tithe_goal?: number | null
          updated_at?: string
          user_id: string
          values_text?: string | null
        }
        Update: {
          anniversary?: string | null
          birthday?: string | null
          children_count?: number | null
          church_name?: string | null
          country?: string | null
          created_at?: string
          data_consent_at?: string | null
          emergency_info?: string | null
          full_name?: string | null
          ideal_day_off?: string | null
          ideal_sabbath?: string | null
          ideal_work_day?: string | null
          locale?: string | null
          marketing_consent_at?: string | null
          mission?: string | null
          spouse_birthday?: string | null
          spouse_name?: string | null
          timezone?: string
          tithe_goal?: number | null
          updated_at?: string
          user_id?: string
          values_text?: string | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          created_at: string
          id: string
          linked_event_id: string | null
          object_type: string
          payload: Json | null
          provider: Database["public"]["Enums"]["provider"]
          provider_etag: string | null
          provider_object_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_event_id?: string | null
          object_type: string
          payload?: Json | null
          provider: Database["public"]["Enums"]["provider"]
          provider_etag?: string | null
          provider_object_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_event_id?: string | null
          object_type?: string
          payload?: Json | null
          provider?: Database["public"]["Enums"]["provider"]
          provider_etag?: string | null
          provider_object_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events_backup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_backup"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tithe_organizations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          org_name: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          org_name: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          org_name?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tithe_organizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_backup"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      direction: "inbound" | "outbound" | "internal"
      event_kind:
        | "meeting"
        | "call"
        | "message"
        | "email"
        | "drive"
        | "sleep"
        | "task"
        | "note"
        | "other"
      event_type:
        | "meeting"
        | "call"
        | "message"
        | "email"
        | "drive"
        | "sleep"
        | "task"
        | "note"
        | "other"
        | "communication"
        | "goal"
        | "project"
        | "category"
        | "tag"
        | "slack_message"
        | "sms"
        | "phone_call"
        | "video_call"
        | "chat"
      priority: "low" | "medium" | "high" | "urgent"
      provider:
        | "google"
        | "microsoft"
        | "slack"
        | "apple_health"
        | "google_fit"
        | "smartcar"
        | "manual"
      task_status: "todo" | "in_progress" | "blocked" | "done" | "archived"
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
  public: {
    Enums: {
      direction: ["inbound", "outbound", "internal"],
      event_kind: [
        "meeting",
        "call",
        "message",
        "email",
        "drive",
        "sleep",
        "task",
        "note",
        "other",
      ],
      event_type: [
        "meeting",
        "call",
        "message",
        "email",
        "drive",
        "sleep",
        "task",
        "note",
        "other",
        "communication",
        "goal",
        "project",
        "category",
        "tag",
        "slack_message",
        "sms",
        "phone_call",
        "video_call",
        "chat",
      ],
      priority: ["low", "medium", "high", "urgent"],
      provider: [
        "google",
        "microsoft",
        "slack",
        "apple_health",
        "google_fit",
        "smartcar",
        "manual",
      ],
      task_status: ["todo", "in_progress", "blocked", "done", "archived"],
    },
  },
} as const
