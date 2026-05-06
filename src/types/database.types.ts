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
  public: {
    Tables: {
      analytics_daily: {
        Row: {
          avg_messages_per_conversation: number
          created_at: string
          date: string
          id: string
          theatre_id: string
          total_conversations: number
          total_messages: number
          updated_at: string
        }
        Insert: {
          avg_messages_per_conversation?: number
          created_at?: string
          date: string
          id?: string
          theatre_id: string
          total_conversations?: number
          total_messages?: number
          updated_at?: string
        }
        Update: {
          avg_messages_per_conversation?: number
          created_at?: string
          date?: string
          id?: string
          theatre_id?: string
          total_conversations?: number
          total_messages?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ended_at: string | null
          id: string
          last_message_at: string | null
          message_count: number
          metadata: Json | null
          session_id: string
          started_at: string
          theatre_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json | null
          session_id: string
          started_at?: string
          theatre_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json | null
          session_id?: string
          started_at?: string
          theatre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_topics: {
        Row: {
          channel: string
          created_at: string | null
          id: string
          session_id: string | null
          theatre_id: string | null
          topic: string | null
          user_message: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          id?: string
          session_id?: string | null
          theatre_id?: string | null
          topic?: string | null
          user_message?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          id?: string
          session_id?: string | null
          theatre_id?: string | null
          topic?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_topics_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          active: boolean
          answer: string
          category: string | null
          created_at: string
          id: string
          language: string
          metadata: Json
          priority: number
          question: string
          source_id: string | null
          theatre_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          language?: string
          metadata?: Json
          priority?: number
          question: string
          source_id?: string | null
          theatre_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          language?: string
          metadata?: Json
          priority?: number
          question?: string
          source_id?: string | null
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          config: Json
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
          source_url: string | null
          status: string
          theatre_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          source_url?: string | null
          status?: string
          theatre_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          source_url?: string | null
          status?: string
          theatre_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
          theatre_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["message_role"]
          theatre_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          theatre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          theatre_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_invites_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          config: Json
          created_at: string
          disabled_at: string | null
          enabled_at: string | null
          id: string
          module_key: string
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string | null
          id?: string
          module_key: string
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string | null
          id?: string
          module_key?: string
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      theatres: {
        Row: {
          created_at: string
          elevenlabs_agent_id: string | null
          entity_type: string
          fallback_email: string | null
          fallback_phone: string | null
          id: string
          n8n_hmac_secret: string | null
          n8n_webhook_url: string | null
          name: string
          onboarding_completed: boolean
          onboarding_goals: Json
          plan: string
          primary_language: string
          scrape_urls: Json
          slug: string
          system_prompt: string | null
          updated_at: string
          website_url: string | null
          voice_enabled: boolean
          voice_id: string | null
          voice_language: string
          voice_max_turns: number
          voice_phone_number: string | null
          voice_system_prompt: string | null
          voice_temperature: number
          voice_tone: string
          webhook_secret: string | null
          widget_config: Json
        }
        Insert: {
          created_at?: string
          elevenlabs_agent_id?: string | null
          entity_type?: string
          fallback_email?: string | null
          fallback_phone?: string | null
          id?: string
          n8n_hmac_secret?: string | null
          n8n_webhook_url?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_goals?: Json
          plan?: string
          primary_language?: string
          scrape_urls?: Json
          slug: string
          system_prompt?: string | null
          updated_at?: string
          website_url?: string | null
          voice_enabled?: boolean
          voice_id?: string | null
          voice_language?: string
          voice_max_turns?: number
          voice_phone_number?: string | null
          voice_system_prompt?: string | null
          voice_temperature?: number
          voice_tone?: string
          webhook_secret?: string | null
          widget_config?: Json
        }
        Update: {
          created_at?: string
          elevenlabs_agent_id?: string | null
          entity_type?: string
          fallback_email?: string | null
          fallback_phone?: string | null
          id?: string
          n8n_hmac_secret?: string | null
          n8n_webhook_url?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_goals?: Json
          plan?: string
          primary_language?: string
          scrape_urls?: Json
          slug?: string
          system_prompt?: string | null
          updated_at?: string
          website_url?: string | null
          voice_enabled?: boolean
          voice_id?: string | null
          voice_language?: string
          voice_max_turns?: number
          voice_phone_number?: string | null
          voice_system_prompt?: string | null
          voice_temperature?: number
          voice_tone?: string
          webhook_secret?: string | null
          widget_config?: Json
        }
        Relationships: []
      }
      voice_conversations: {
        Row: {
          call_sid: string
          created_at: string
          duration_sec: number | null
          from_number: string | null
          id: string
          status: string | null
          summary: string | null
          theatre_id: string
          topic: string | null
          transcript: Json | null
          turns: number | null
        }
        Insert: {
          call_sid: string
          created_at?: string
          duration_sec?: number | null
          from_number?: string | null
          id?: string
          status?: string | null
          summary?: string | null
          theatre_id: string
          topic?: string | null
          transcript?: Json | null
          turns?: number | null
        }
        Update: {
          call_sid?: string
          created_at?: string
          duration_sec?: number | null
          from_number?: string | null
          id?: string
          status?: string | null
          summary?: string | null
          theatre_id?: string
          topic?: string | null
          transcript?: Json | null
          turns?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_conversations_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          theatre_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_theatre_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      message_role: "user" | "assistant"
      user_role: "owner" | "admin" | "operator" | "analyst" | "viewer"
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
      message_role: ["user", "assistant"],
      user_role: ["owner", "admin", "operator", "analyst", "viewer"],
    },
  },
} as const
