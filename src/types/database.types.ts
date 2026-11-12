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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_membership_permissions: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          permission_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          permission_key: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_membership_permissions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "account_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      account_memberships: {
        Row: {
          account_id: string
          created_at: string
          id: string
          invited_by: string | null
          permissions: Json
          profile_id: string
          revoked_at: string | null
          role: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          profile_id: string
          revoked_at?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          profile_id?: string
          revoked_at?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          billing_currency: string
          billing_email: string | null
          created_at: string
          id: string
          market_country_code: string | null
          metadata: Json
          name: string
          plan: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_currency?: string
          billing_email?: string | null
          created_at?: string
          id?: string
          market_country_code?: string | null
          metadata?: Json
          name: string
          plan?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_currency?: string
          billing_email?: string | null
          created_at?: string
          id?: string
          market_country_code?: string | null
          metadata?: Json
          name?: string
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_model_pricing: {
        Row: {
          cached_input_usd_micros_per_million: number
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          input_usd_micros_per_million: number
          model: string
          output_usd_micros_per_million: number
          provider: string
          source_url: string
          web_search_usd_micros_per_call: number
        }
        Insert: {
          cached_input_usd_micros_per_million?: number
          created_at?: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          input_usd_micros_per_million?: number
          model: string
          output_usd_micros_per_million?: number
          provider: string
          source_url: string
          web_search_usd_micros_per_call?: number
        }
        Update: {
          cached_input_usd_micros_per_million?: number
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          input_usd_micros_per_million?: number
          model?: string
          output_usd_micros_per_million?: number
          provider?: string
          source_url?: string
          web_search_usd_micros_per_call?: number
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          accuracy: string
          cached_input_tokens: number
          component: string
          cost_usd_micros: number
          created_at: string
          id: string
          idempotency_key: string
          input_tokens: number
          metadata: Json
          model: string
          occurred_at: string
          output_tokens: number
          pricing_id: string | null
          provider: string
          request_count: number
          session_id: string | null
          theatre_id: string
          tool_call_count: number
          usage_event_id: string | null
        }
        Insert: {
          accuracy: string
          cached_input_tokens?: number
          component: string
          cost_usd_micros?: number
          created_at?: string
          id?: string
          idempotency_key: string
          input_tokens?: number
          metadata?: Json
          model: string
          occurred_at?: string
          output_tokens?: number
          pricing_id?: string | null
          provider: string
          request_count?: number
          session_id?: string | null
          theatre_id: string
          tool_call_count?: number
          usage_event_id?: string | null
        }
        Update: {
          accuracy?: string
          cached_input_tokens?: number
          component?: string
          cost_usd_micros?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          input_tokens?: number
          metadata?: Json
          model?: string
          occurred_at?: string
          output_tokens?: number
          pricing_id?: string | null
          provider?: string
          request_count?: number
          session_id?: string | null
          theatre_id?: string
          tool_call_count?: number
          usage_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "ai_model_pricing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_usage_event_id_fkey"
            columns: ["usage_event_id"]
            isOneToOne: false
            referencedRelation: "usage_events"
            referencedColumns: ["id"]
          },
        ]
      }
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
      audit_events: {
        Row: {
          account_id: string | null
          action: string
          actor_profile_id: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string
          theatre_id: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_profile_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type: string
          theatre_id?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_profile_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string
          theatre_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_theatre_id_fkey"
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
          classification_source: string | null
          confidence: number | null
          created_at: string | null
          id: string
          intent: string | null
          message_id: string | null
          session_id: string | null
          taxonomy_version: string | null
          theatre_id: string | null
          topic: string | null
          user_message: string | null
        }
        Insert: {
          channel?: string
          classification_source?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          session_id?: string | null
          taxonomy_version?: string | null
          theatre_id?: string | null
          topic?: string | null
          user_message?: string | null
        }
        Update: {
          channel?: string
          classification_source?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          session_id?: string | null
          taxonomy_version?: string | null
          theatre_id?: string | null
          topic?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_topics_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_topics_theatre_id_fkey"
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
      email_connections: {
        Row: {
          created_at: string
          draft_mode: string
          error_message: string | null
          id: string
          last_synced_at: string | null
          mailbox_email: string
          metadata: Json
          oauth_metadata: Json
          provider: string
          status: string
          sync_cursor: string | null
          sync_mode: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_mode?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          mailbox_email: string
          metadata?: Json
          oauth_metadata?: Json
          provider?: string
          status?: string
          sync_cursor?: string | null
          sync_mode?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_mode?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          mailbox_email?: string
          metadata?: Json
          oauth_metadata?: Json
          provider?: string
          status?: string
          sync_cursor?: string | null
          sync_mode?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_connections_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          approved_at: string | null
          connection_id: string
          created_at: string
          error_message: string | null
          generated_body_html: string | null
          generated_body_text: string | null
          generated_subject: string | null
          id: string
          metadata: Json
          provider_draft_id: string | null
          reviewed_by_profile_id: string | null
          sent_at: string | null
          status: string
          theatre_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          connection_id: string
          created_at?: string
          error_message?: string | null
          generated_body_html?: string | null
          generated_body_text?: string | null
          generated_subject?: string | null
          id?: string
          metadata?: Json
          provider_draft_id?: string | null
          reviewed_by_profile_id?: string | null
          sent_at?: string | null
          status?: string
          theatre_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          connection_id?: string
          created_at?: string
          error_message?: string | null
          generated_body_html?: string | null
          generated_body_text?: string | null
          generated_subject?: string | null
          id?: string
          metadata?: Json
          provider_draft_id?: string | null
          reviewed_by_profile_id?: string | null
          sent_at?: string | null
          status?: string
          theatre_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_tenant_thread_fk"
            columns: ["theatre_id", "connection_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
          {
            foreignKeyName: "email_drafts_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_message_suppressions: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          provider_message_id_hash: string
          theatre_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          provider_message_id_hash: string
          theatre_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          provider_message_id_hash?: string
          theatre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_message_suppressions_tenant_connection_fk"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "email_message_suppressions_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_emails: Json
          connection_id: string
          created_at: string
          direction: string
          from_email: string | null
          from_name: string | null
          id: string
          metadata: Json
          provider_message_id: string
          received_at: string | null
          sent_at: string | null
          theatre_id: string
          thread_id: string
          to_emails: Json
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json
          connection_id: string
          created_at?: string
          direction: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          metadata?: Json
          provider_message_id: string
          received_at?: string | null
          sent_at?: string | null
          theatre_id: string
          thread_id: string
          to_emails?: Json
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json
          connection_id?: string
          created_at?: string
          direction?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          metadata?: Json
          provider_message_id?: string
          received_at?: string | null
          sent_at?: string | null
          theatre_id?: string
          thread_id?: string
          to_emails?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_tenant_thread_fk"
            columns: ["theatre_id", "connection_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
          {
            foreignKeyName: "email_messages_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_runs: {
        Row: {
          checked_count: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          failed_count: number
          id: string
          imported_count: number
          inspected_count: number
          lease_expires_at: string
          metadata: Json
          processed_count: number
          skipped_count: number
          started_at: string
          status: string
          synced_count: number
          trigger_source: string
          worker_id: string
        }
        Insert: {
          checked_count?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failed_count?: number
          id?: string
          imported_count?: number
          inspected_count?: number
          lease_expires_at: string
          metadata?: Json
          processed_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          synced_count?: number
          trigger_source?: string
          worker_id: string
        }
        Update: {
          checked_count?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failed_count?: number
          id?: string
          imported_count?: number
          inspected_count?: number
          lease_expires_at?: string
          metadata?: Json
          processed_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          synced_count?: number
          trigger_source?: string
          worker_id?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          assigned_profile_id: string | null
          connection_id: string
          created_at: string
          id: string
          last_message_at: string | null
          metadata: Json
          priority: string
          provider_thread_id: string
          sender_email: string | null
          sender_name: string | null
          status: string
          subject: string | null
          theatre_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          assigned_profile_id?: string | null
          connection_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json
          priority?: string
          provider_thread_id: string
          sender_email?: string | null
          sender_name?: string | null
          status?: string
          subject?: string | null
          theatre_id: string
          topic?: string
          updated_at?: string
        }
        Update: {
          assigned_profile_id?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json
          priority?: string
          provider_thread_id?: string
          sender_email?: string | null
          sender_name?: string | null
          status?: string
          subject?: string | null
          theatre_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_tenant_connection_fk"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "email_threads_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          account_type: string
          created_at: string
          credential_metadata: Json
          id: string
          instagram_user_id: string
          metadata: Json
          rollout_enabled: boolean
          scopes: string[]
          status: string
          theatre_id: string
          updated_at: string
          username: string
        }
        Insert: {
          account_type: string
          created_at?: string
          credential_metadata?: Json
          id?: string
          instagram_user_id: string
          metadata?: Json
          rollout_enabled?: boolean
          scopes?: string[]
          status?: string
          theatre_id: string
          updated_at?: string
          username: string
        }
        Update: {
          account_type?: string
          created_at?: string
          credential_metadata?: Json
          id?: string
          instagram_user_id?: string
          metadata?: Json
          rollout_enabled?: boolean
          scopes?: string[]
          status?: string
          theatre_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: true
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_contacts: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          instagram_scoped_user_id: string
          last_seen_at: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          instagram_scoped_user_id: string
          last_seen_at?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          instagram_scoped_user_id?: string
          last_seen_at?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_contacts_connection_fk"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["theatre_id", "id"]
          },
        ]
      }
      instagram_conversations: {
        Row: {
          assigned_profile_id: string | null
          claimed_at: string | null
          connection_id: string
          contact_id: string
          created_at: string
          id: string
          last_message_at: string | null
          metadata: Json
          resolved_at: string | null
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          assigned_profile_id?: string | null
          claimed_at?: string | null
          connection_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json
          resolved_at?: string | null
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          assigned_profile_id?: string | null
          claimed_at?: string | null
          connection_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json
          resolved_at?: string | null
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_conversations_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_conversations_contact_fk"
            columns: ["theatre_id", "connection_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "instagram_contacts"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
        ]
      }
      instagram_inbound_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          connection_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          lease_expires_at: string | null
          message_id: string
          status: string
          theatre_id: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          lease_expires_at?: string | null
          message_id: string
          status?: string
          theatre_id: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          lease_expires_at?: string | null
          message_id?: string
          status?: string
          theatre_id?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_inbound_jobs_message_fk"
            columns: ["theatre_id", "connection_id", "message_id"]
            isOneToOne: false
            referencedRelation: "instagram_messages"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
        ]
      }
      instagram_messages: {
        Row: {
          body_text: string | null
          connection_id: string
          contact_id: string
          context_provider_message_id: string | null
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          id: string
          message_type: string
          metadata: Json
          processing_status: string
          provider_message_id: string
          provider_timestamp: string | null
          theatre_id: string
          updated_at: string
        }
        Insert: {
          body_text?: string | null
          connection_id: string
          contact_id: string
          context_provider_message_id?: string | null
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction: string
          id?: string
          message_type: string
          metadata?: Json
          processing_status?: string
          provider_message_id: string
          provider_timestamp?: string | null
          theatre_id: string
          updated_at?: string
        }
        Update: {
          body_text?: string | null
          connection_id?: string
          contact_id?: string
          context_provider_message_id?: string | null
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          message_type?: string
          metadata?: Json
          processing_status?: string
          provider_message_id?: string
          provider_timestamp?: string | null
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_messages_contact_fk"
            columns: ["theatre_id", "connection_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "instagram_contacts"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
          {
            foreignKeyName: "instagram_messages_conversation_fk"
            columns: ["theatre_id", "connection_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "instagram_conversations"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          active: boolean
          chunk_index: number
          content: string
          created_at: string
          document_id: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_updated_at: string | null
          id: string
          language: string
          metadata: Json
          source_id: string | null
          theatre_id: string
          token_count: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          chunk_index: number
          content: string
          created_at?: string
          document_id?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          id?: string
          language?: string
          metadata?: Json
          source_id?: string | null
          theatre_id: string
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          id?: string
          language?: string
          metadata?: Json
          source_id?: string | null
          theatre_id?: string
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_theatre_fkey"
            columns: ["document_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id", "theatre_id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          canonical_url: string
          capture_method: string | null
          content_hash: string | null
          created_at: string
          etag: string | null
          failure_count: number
          fetched_url: string | null
          id: string
          last_discovered_at: string | null
          last_error: string | null
          last_fetched_at: string | null
          last_modified: string | null
          metadata: Json
          removed_at: string | null
          source_id: string
          status: string
          theatre_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          canonical_url: string
          capture_method?: string | null
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          failure_count?: number
          fetched_url?: string | null
          id?: string
          last_discovered_at?: string | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          metadata?: Json
          removed_at?: string | null
          source_id: string
          status?: string
          theatre_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string
          capture_method?: string | null
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          failure_count?: number
          fetched_url?: string | null
          id?: string
          last_discovered_at?: string | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          metadata?: Json
          removed_at?: string | null
          source_id?: string
          status?: string
          theatre_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_source_theatre_fkey"
            columns: ["source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id", "theatre_id"]
          },
          {
            foreignKeyName: "knowledge_documents_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_domain_fetch_leases: {
        Row: {
          created_at: string
          domain: string
          id: string
          lease_expires_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          lease_expires_at: string
          worker_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          lease_expires_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_domain_fetch_leases_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "knowledge_domain_fetch_windows"
            referencedColumns: ["domain"]
          },
        ]
      }
      knowledge_domain_fetch_windows: {
        Row: {
          domain: string
          next_allowed_at: string
          updated_at: string
        }
        Insert: {
          domain: string
          next_allowed_at?: string
          updated_at?: string
        }
        Update: {
          domain?: string
          next_allowed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_items: {
        Row: {
          active: boolean
          answer: string
          category: string | null
          created_at: string
          embedding: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_updated_at: string | null
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
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
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
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
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
      knowledge_source_support_requests: {
        Row: {
          created_at: string
          customer_message: string
          delivered_at: string | null
          delivery_error: string | null
          delivery_status: string
          error_code: string | null
          id: string
          idempotency_key: string
          requested_by: string | null
          source_id: string
          status: string
          sync_run_id: string | null
          theatre_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_message: string
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          error_code?: string | null
          id?: string
          idempotency_key: string
          requested_by?: string | null
          source_id: string
          status?: string
          sync_run_id?: string | null
          theatre_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_message?: string
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string
          requested_by?: string | null
          source_id?: string
          status?: string
          sync_run_id?: string | null
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_source_support_requests_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_source_support_requests_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_source_support_requests_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_source_support_source_theatre_fkey"
            columns: ["source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id", "theatre_id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          config: Json
          created_at: string
          id: string
          last_error: string | null
          last_sync_run_id: string | null
          last_synced_at: string | null
          name: string
          next_sync_at: string | null
          refresh_interval: string
          source_url: string | null
          status: string
          sync_enabled: boolean
          theatre_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          name: string
          next_sync_at?: string | null
          refresh_interval?: string
          source_url?: string | null
          status?: string
          sync_enabled?: boolean
          theatre_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          name?: string
          next_sync_at?: string | null
          refresh_interval?: string
          source_url?: string | null
          status?: string
          sync_enabled?: boolean
          theatre_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_sources_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sync_runs: {
        Row: {
          attempt_count: number
          blocked_count: number
          changed_count: number
          checked_count: number
          created_at: string
          deactivated_count: number
          discovered_count: number
          error_code: string | null
          error_details: string | null
          failed_count: number
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          metadata: Json
          source_id: string
          started_at: string | null
          status: string
          theatre_id: string
          trigger: string
          unchanged_count: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          blocked_count?: number
          changed_count?: number
          checked_count?: number
          created_at?: string
          deactivated_count?: number
          discovered_count?: number
          error_code?: string | null
          error_details?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          idempotency_key: string
          lease_expires_at?: string | null
          metadata?: Json
          source_id: string
          started_at?: string | null
          status?: string
          theatre_id: string
          trigger?: string
          unchanged_count?: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          blocked_count?: number
          changed_count?: number
          checked_count?: number
          created_at?: string
          deactivated_count?: number
          discovered_count?: number
          error_code?: string | null
          error_details?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          lease_expires_at?: string | null
          metadata?: Json
          source_id?: string
          started_at?: string | null
          status?: string
          theatre_id?: string
          trigger?: string
          unchanged_count?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sync_runs_source_theatre_fkey"
            columns: ["source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id", "theatre_id"]
          },
          {
            foreignKeyName: "knowledge_sync_runs_theatre_id_fkey"
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
          metadata: Json
          role: Database["public"]["Enums"]["message_role"]
          theatre_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["message_role"]
          theatre_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
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
      meta_marketing_ad_creation_requests: {
        Row: {
          actor_profile_id: string
          actor_user_id: string
          call_to_action: string
          connection_id: string
          created_at: string
          destination_url: string
          error_code: string | null
          headline: string
          id: string
          image_mime_type: string | null
          image_sha256: string | null
          image_size_bytes: number | null
          image_url: string | null
          name: string
          page_id: string
          primary_text: string
          provider_ad_id: string | null
          provider_ad_set_id: string
          provider_creative_id: string | null
          provider_image_hash: string | null
          request_id: string
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          actor_profile_id: string
          actor_user_id: string
          call_to_action: string
          connection_id: string
          created_at?: string
          destination_url: string
          error_code?: string | null
          headline: string
          id?: string
          image_mime_type?: string | null
          image_sha256?: string | null
          image_size_bytes?: number | null
          image_url?: string | null
          name: string
          page_id: string
          primary_text: string
          provider_ad_id?: string | null
          provider_ad_set_id: string
          provider_creative_id?: string | null
          provider_image_hash?: string | null
          request_id: string
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          actor_profile_id?: string
          actor_user_id?: string
          call_to_action?: string
          connection_id?: string
          created_at?: string
          destination_url?: string
          error_code?: string | null
          headline?: string
          id?: string
          image_mime_type?: string | null
          image_sha256?: string | null
          image_size_bytes?: number | null
          image_url?: string | null
          name?: string
          page_id?: string
          primary_text?: string
          provider_ad_id?: string | null
          provider_ad_set_id?: string
          provider_creative_id?: string | null
          provider_image_hash?: string | null
          request_id?: string
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_marketing_ad_creation_reques_theatre_id_connection_id_fkey"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "meta_marketing_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "meta_marketing_ad_creation_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_marketing_ad_creation_requests_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_marketing_ad_set_creation_requests: {
        Row: {
          actor_profile_id: string
          actor_user_id: string
          age_max: number
          age_min: number
          connection_id: string
          countries: string[]
          created_at: string
          currency: string
          daily_budget_minor: number
          end_time: string
          error_code: string | null
          id: string
          name: string
          objective: string
          provider_ad_set_id: string | null
          provider_campaign_id: string
          request_id: string
          start_time: string
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          actor_profile_id: string
          actor_user_id: string
          age_max: number
          age_min: number
          connection_id: string
          countries: string[]
          created_at?: string
          currency: string
          daily_budget_minor: number
          end_time: string
          error_code?: string | null
          id?: string
          name: string
          objective?: string
          provider_ad_set_id?: string | null
          provider_campaign_id: string
          request_id: string
          start_time: string
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          actor_profile_id?: string
          actor_user_id?: string
          age_max?: number
          age_min?: number
          connection_id?: string
          countries?: string[]
          created_at?: string
          currency?: string
          daily_budget_minor?: number
          end_time?: string
          error_code?: string | null
          id?: string
          name?: string
          objective?: string
          provider_ad_set_id?: string | null
          provider_campaign_id?: string
          request_id?: string
          start_time?: string
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_marketing_ad_set_creation_re_theatre_id_connection_id_fkey"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "meta_marketing_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "meta_marketing_ad_set_creation_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_marketing_ad_set_creation_requests_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_marketing_campaign_creation_requests: {
        Row: {
          actor_profile_id: string
          actor_user_id: string
          connection_id: string
          created_at: string
          error_code: string | null
          id: string
          name: string
          objective: string
          provider_campaign_id: string | null
          request_id: string
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          actor_profile_id: string
          actor_user_id: string
          connection_id: string
          created_at?: string
          error_code?: string | null
          id?: string
          name: string
          objective: string
          provider_campaign_id?: string | null
          request_id: string
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          actor_profile_id?: string
          actor_user_id?: string
          connection_id?: string
          created_at?: string
          error_code?: string | null
          id?: string
          name?: string
          objective?: string
          provider_campaign_id?: string | null
          request_id?: string
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_marketing_campaign_creation__theatre_id_connection_id_fkey"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "meta_marketing_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "meta_marketing_campaign_creation_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_marketing_campaign_creation_requests_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_marketing_campaign_snapshots: {
        Row: {
          campaign_created_at: string | null
          campaign_id: string
          campaign_updated_at: string | null
          configured_status: string
          connection_id: string
          cpc: number | null
          created_at: string
          ctr: number
          effective_status: string
          ends_at: string | null
          frequency: number
          id: string
          impressions: number
          insights_date_start: string | null
          insights_date_stop: string | null
          link_clicks: number
          name: string
          objective: string | null
          period: string
          reach: number
          spend: number
          starts_at: string | null
          synced_at: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          campaign_created_at?: string | null
          campaign_id: string
          campaign_updated_at?: string | null
          configured_status: string
          connection_id: string
          cpc?: number | null
          created_at?: string
          ctr?: number
          effective_status: string
          ends_at?: string | null
          frequency?: number
          id?: string
          impressions?: number
          insights_date_start?: string | null
          insights_date_stop?: string | null
          link_clicks?: number
          name: string
          objective?: string | null
          period?: string
          reach?: number
          spend?: number
          starts_at?: string | null
          synced_at: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          campaign_created_at?: string | null
          campaign_id?: string
          campaign_updated_at?: string | null
          configured_status?: string
          connection_id?: string
          cpc?: number | null
          created_at?: string
          ctr?: number
          effective_status?: string
          ends_at?: string | null
          frequency?: number
          id?: string
          impressions?: number
          insights_date_start?: string | null
          insights_date_stop?: string | null
          link_clicks?: number
          name?: string
          objective?: string | null
          period?: string
          reach?: number
          spend?: number
          starts_at?: string | null
          synced_at?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_marketing_campaign_snapshots_theatre_id_connection_id_fkey"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "meta_marketing_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "meta_marketing_campaign_snapshots_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_marketing_connections: {
        Row: {
          ad_account_currency: string | null
          ad_account_id: string
          ad_account_name: string | null
          business_id: string
          business_name: string | null
          created_at: string
          credential_metadata: Json
          id: string
          meta_user_id: string
          metadata: Json
          rollout_enabled: boolean
          scopes: string[]
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          ad_account_currency?: string | null
          ad_account_id: string
          ad_account_name?: string | null
          business_id: string
          business_name?: string | null
          created_at?: string
          credential_metadata?: Json
          id?: string
          meta_user_id: string
          metadata?: Json
          rollout_enabled?: boolean
          scopes?: string[]
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          ad_account_currency?: string | null
          ad_account_id?: string
          ad_account_name?: string | null
          business_id?: string
          business_name?: string | null
          created_at?: string
          credential_metadata?: Json
          id?: string
          meta_user_id?: string
          metadata?: Json
          rollout_enabled?: boolean
          scopes?: string[]
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_marketing_connections_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: true
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_marketing_daily_insights: {
        Row: {
          connection_id: string
          cpc: number | null
          created_at: string
          ctr: number
          frequency: number
          id: string
          impressions: number
          insight_date: string
          link_clicks: number
          period: string
          reach: number
          spend: number
          synced_at: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          cpc?: number | null
          created_at?: string
          ctr?: number
          frequency?: number
          id?: string
          impressions?: number
          insight_date: string
          link_clicks?: number
          period?: string
          reach?: number
          spend?: number
          synced_at: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          cpc?: number | null
          created_at?: string
          ctr?: number
          frequency?: number
          id?: string
          impressions?: number
          insight_date?: string
          link_clicks?: number
          period?: string
          reach?: number
          spend?: number
          synced_at?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_marketing_daily_insights_theatre_id_connection_id_fkey"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "meta_marketing_connections"
            referencedColumns: ["theatre_id", "id"]
          },
          {
            foreignKeyName: "meta_marketing_daily_insights_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          permissions: Json
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          permissions?: Json
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          permissions?: Json
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          metadata: Json
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          metadata?: Json
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          metadata?: Json
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      programme_events: {
        Row: {
          active: boolean
          confidence: number
          created_at: string
          description: string | null
          document_id: string
          duration_minutes: number | null
          event_key: string
          event_language: string | null
          evidence: Json
          extracted_at: string
          id: string
          location: Json | null
          occurrences: Json
          offers: Json
          participants: Json
          rendered_text: string
          source_id: string
          source_language: string
          source_url: string
          theatre_id: string
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          confidence: number
          created_at?: string
          description?: string | null
          document_id: string
          duration_minutes?: number | null
          event_key: string
          event_language?: string | null
          evidence?: Json
          extracted_at?: string
          id?: string
          location?: Json | null
          occurrences?: Json
          offers?: Json
          participants?: Json
          rendered_text: string
          source_id: string
          source_language?: string
          source_url: string
          theatre_id: string
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          confidence?: number
          created_at?: string
          description?: string | null
          document_id?: string
          duration_minutes?: number | null
          event_key?: string
          event_language?: string | null
          evidence?: Json
          extracted_at?: string
          id?: string
          location?: Json | null
          occurrences?: Json
          offers?: Json
          participants?: Json
          rendered_text?: string
          source_id?: string
          source_language?: string
          source_url?: string
          theatre_id?: string
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_events_document_source_theatre_fkey"
            columns: ["document_id", "source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id", "source_id", "theatre_id"]
          },
          {
            foreignKeyName: "programme_events_source_theatre_fkey"
            columns: ["source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id", "theatre_id"]
          },
          {
            foreignKeyName: "programme_events_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      security_rate_limits: {
        Row: {
          expires_at: string
          key_hash: string
          request_count: number
          scope: string
          window_seconds: number
          window_started_at: string
        }
        Insert: {
          expires_at: string
          key_hash: string
          request_count: number
          scope: string
          window_seconds: number
          window_started_at: string
        }
        Update: {
          expires_at?: string
          key_hash?: string
          request_count?: number
          scope?: string
          window_seconds?: number
          window_started_at?: string
        }
        Relationships: []
      }
      signup_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          permissions: Json
          revoked_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          theatre_id: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_invites_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_invites_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_module_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          limits: Json
          metadata: Json
          module_key: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          limits?: Json
          metadata?: Json
          module_key: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          limits?: Json
          metadata?: Json
          module_key?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_entitlements_theatre_id_fkey"
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
      tenant_subscriptions: {
        Row: {
          billing_period_end: string
          billing_period_end_at: string
          billing_period_start: string
          billing_period_start_at: string
          created_at: string
          hard_limit_behavior: string
          hard_limit_enabled: boolean
          id: string
          included_chat_conversations: number
          included_email_conversations: number
          included_voice_minutes: number
          metadata: Json
          overage_price_chat_cents: number
          overage_price_email_cents: number
          overage_price_voice_minute_cents: number
          plan: string
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          billing_period_end?: string
          billing_period_end_at?: string
          billing_period_start?: string
          billing_period_start_at?: string
          created_at?: string
          hard_limit_behavior?: string
          hard_limit_enabled?: boolean
          id?: string
          included_chat_conversations?: number
          included_email_conversations?: number
          included_voice_minutes?: number
          metadata?: Json
          overage_price_chat_cents?: number
          overage_price_email_cents?: number
          overage_price_voice_minute_cents?: number
          plan?: string
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          billing_period_end?: string
          billing_period_end_at?: string
          billing_period_start?: string
          billing_period_start_at?: string
          created_at?: string
          hard_limit_behavior?: string
          hard_limit_enabled?: boolean
          id?: string
          included_chat_conversations?: number
          included_email_conversations?: number
          included_voice_minutes?: number
          metadata?: Json
          overage_price_chat_cents?: number
          overage_price_email_cents?: number
          overage_price_voice_minute_cents?: number
          plan?: string
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage_daily: {
        Row: {
          ai_calls: number
          channel: string
          conversations: number
          created_at: string
          date: string
          estimated_cost_cents: number
          fallbacks: number
          id: string
          input_tokens: number
          limit_exceeded_events: number
          messages: number
          module_key: string
          output_tokens: number
          resolutions: number
          theatre_id: string
          tool_calls: number
          updated_at: string
          voice_minutes: number
        }
        Insert: {
          ai_calls?: number
          channel: string
          conversations?: number
          created_at?: string
          date: string
          estimated_cost_cents?: number
          fallbacks?: number
          id?: string
          input_tokens?: number
          limit_exceeded_events?: number
          messages?: number
          module_key: string
          output_tokens?: number
          resolutions?: number
          theatre_id: string
          tool_calls?: number
          updated_at?: string
          voice_minutes?: number
        }
        Update: {
          ai_calls?: number
          channel?: string
          conversations?: number
          created_at?: string
          date?: string
          estimated_cost_cents?: number
          fallbacks?: number
          id?: string
          input_tokens?: number
          limit_exceeded_events?: number
          messages?: number
          module_key?: string
          output_tokens?: number
          resolutions?: number
          theatre_id?: string
          tool_calls?: number
          updated_at?: string
          voice_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_daily_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      theatres: {
        Row: {
          account_id: string
          created_at: string
          elevenlabs_agent_id: string | null
          entity_type: string
          fallback_email: string | null
          fallback_phone: string | null
          id: string
          name: string
          onboarding_completed: boolean
          onboarding_goals: Json
          plan: string
          primary_language: string
          scrape_urls: Json
          slug: string
          system_prompt: string | null
          updated_at: string
          voice_enabled: boolean
          voice_forwarding_notes: string | null
          voice_id: string | null
          voice_language: string
          voice_max_turns: number
          voice_operational_status: string
          voice_phone_mode: string
          voice_phone_number: string | null
          voice_phone_provider: string
          voice_public_phone_number: string | null
          voice_system_prompt: string | null
          voice_temperature: number
          voice_tone: string
          website_url: string | null
          widget_config: Json
        }
        Insert: {
          account_id: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          entity_type?: string
          fallback_email?: string | null
          fallback_phone?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean
          onboarding_goals?: Json
          plan?: string
          primary_language?: string
          scrape_urls?: Json
          slug: string
          system_prompt?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_forwarding_notes?: string | null
          voice_id?: string | null
          voice_language?: string
          voice_max_turns?: number
          voice_operational_status?: string
          voice_phone_mode?: string
          voice_phone_number?: string | null
          voice_phone_provider?: string
          voice_public_phone_number?: string | null
          voice_system_prompt?: string | null
          voice_temperature?: number
          voice_tone?: string
          website_url?: string | null
          widget_config?: Json
        }
        Update: {
          account_id?: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          entity_type?: string
          fallback_email?: string | null
          fallback_phone?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          onboarding_goals?: Json
          plan?: string
          primary_language?: string
          scrape_urls?: Json
          slug?: string
          system_prompt?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_forwarding_notes?: string | null
          voice_id?: string | null
          voice_language?: string
          voice_max_turns?: number
          voice_operational_status?: string
          voice_phone_mode?: string
          voice_phone_number?: string | null
          voice_phone_provider?: string
          voice_public_phone_number?: string | null
          voice_system_prompt?: string | null
          voice_temperature?: number
          voice_tone?: string
          website_url?: string | null
          widget_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "theatres_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          channel: string
          cost_estimate_cents: number
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          input_tokens: number
          metadata: Json
          module_key: string
          occurred_at: string
          output_tokens: number
          quantity: number
          subscription_id: string | null
          theatre_id: string
          unit: string
        }
        Insert: {
          channel: string
          cost_estimate_cents?: number
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          input_tokens?: number
          metadata?: Json
          module_key: string
          occurred_at?: string
          output_tokens?: number
          quantity?: number
          subscription_id?: string | null
          theatre_id: string
          unit: string
        }
        Update: {
          channel?: string
          cost_estimate_cents?: number
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          input_tokens?: number
          metadata?: Json
          module_key?: string
          occurred_at?: string
          output_tokens?: number
          quantity?: number
          subscription_id?: string | null
          theatre_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_theatre_id_fkey"
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
      venue_membership_permissions: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          permission_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          permission_key: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_membership_permissions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "venue_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          permissions: Json
          profile_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          theatre_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          profile_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          profile_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_memberships_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_connections: {
        Row: {
          created_at: string
          credential_metadata: Json
          credential_source: string
          display_phone_number: string | null
          id: string
          metadata: Json
          phone_number_id: string
          rollout_enabled: boolean
          status: string
          theatre_id: string
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          created_at?: string
          credential_metadata?: Json
          credential_source?: string
          display_phone_number?: string | null
          id?: string
          metadata?: Json
          phone_number_id: string
          rollout_enabled?: boolean
          status?: string
          theatre_id: string
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          created_at?: string
          credential_metadata?: Json
          credential_source?: string
          display_phone_number?: string | null
          id?: string
          metadata?: Json
          phone_number_id?: string
          rollout_enabled?: boolean
          status?: string
          theatre_id?: string
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          last_seen_at: string
          profile_name: string | null
          theatre_id: string
          updated_at: string
          wa_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          profile_name?: string | null
          theatre_id: string
          updated_at?: string
          wa_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          profile_name?: string | null
          theatre_id?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_connection_fk"
            columns: ["theatre_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["theatre_id", "id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_profile_id: string | null
          claimed_at: string | null
          connection_id: string
          contact_id: string
          created_at: string
          id: string
          last_message_at: string | null
          metadata: Json
          resolved_at: string | null
          status: string
          theatre_id: string
          updated_at: string
        }
        Insert: {
          assigned_profile_id?: string | null
          claimed_at?: string | null
          connection_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json
          resolved_at?: string | null
          status?: string
          theatre_id: string
          updated_at?: string
        }
        Update: {
          assigned_profile_id?: string | null
          claimed_at?: string | null
          connection_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json
          resolved_at?: string | null
          status?: string
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_fk"
            columns: ["theatre_id", "connection_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
        ]
      }
      whatsapp_inbound_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          connection_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          lease_expires_at: string | null
          message_id: string
          status: string
          theatre_id: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          lease_expires_at?: string | null
          message_id: string
          status?: string
          theatre_id: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          lease_expires_at?: string | null
          message_id?: string
          status?: string
          theatre_id?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_jobs_message_fk"
            columns: ["theatre_id", "connection_id", "message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body_text: string | null
          connection_id: string
          contact_id: string
          context_provider_message_id: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          delivery_status_at: string | null
          direction: string
          failed_at: string | null
          id: string
          message_type: string
          metadata: Json
          processing_status: string
          provider_message_id: string
          provider_timestamp: string | null
          read_at: string | null
          sent_at: string | null
          theatre_id: string
          updated_at: string
        }
        Insert: {
          body_text?: string | null
          connection_id: string
          contact_id: string
          context_provider_message_id?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          delivery_status_at?: string | null
          direction: string
          failed_at?: string | null
          id?: string
          message_type: string
          metadata?: Json
          processing_status?: string
          provider_message_id: string
          provider_timestamp?: string | null
          read_at?: string | null
          sent_at?: string | null
          theatre_id: string
          updated_at?: string
        }
        Update: {
          body_text?: string | null
          connection_id?: string
          contact_id?: string
          context_provider_message_id?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          delivery_status_at?: string | null
          direction?: string
          failed_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json
          processing_status?: string
          provider_message_id?: string
          provider_timestamp?: string | null
          read_at?: string | null
          sent_at?: string | null
          theatre_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_fk"
            columns: ["theatre_id", "connection_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_fk"
            columns: ["theatre_id", "connection_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["theatre_id", "connection_id", "id"]
          },
        ]
      }
      widget_installations: {
        Row: {
          first_seen_at: string
          last_seen_at: string
          origin: string
          theatre_id: string
        }
        Insert: {
          first_seen_at?: string
          last_seen_at?: string
          origin: string
          theatre_id: string
        }
        Update: {
          first_seen_at?: string
          last_seen_at?: string
          origin?: string
          theatre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_installations_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_response_usage_daily: {
        Row: {
          accuracy: string | null
          cached_input_tokens: number | null
          cost_usd_micros: number | null
          date: string | null
          input_tokens: number | null
          output_tokens: number | null
          request_count: number | null
          response_count: number | null
          theatre_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_daily: {
        Row: {
          accuracy: string | null
          cached_input_tokens: number | null
          component: string | null
          cost_usd_micros: number | null
          date: string | null
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          provider: string | null
          request_count: number | null
          theatre_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_knowledge_lifecycle_candidates: {
        Row: {
          confidence: number | null
          document_id: string | null
          event_id: string | null
          extracted_at: string | null
          reason: string | null
          recommended_action: string | null
          source_id: string | null
          theatre_id: string | null
          title: string | null
          valid_until: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_events_document_source_theatre_fkey"
            columns: ["document_id", "source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id", "source_id", "theatre_id"]
          },
          {
            foreignKeyName: "programme_events_source_theatre_fkey"
            columns: ["source_id", "theatre_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id", "theatre_id"]
          },
          {
            foreignKeyName: "programme_events_theatre_id_fkey"
            columns: ["theatre_id"]
            isOneToOne: false
            referencedRelation: "theatres"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonymize_web_usage_identifiers: {
        Args: { p_session_id: string; p_theatre_id: string }
        Returns: {
          affected_rows: number
          category: string
        }[]
      }
      apply_chat_message_top_up: {
        Args: {
          p_checkout_session_id: string
          p_messages: number
          p_subscription_id: string
        }
        Returns: boolean
      }
      apply_data_retention: {
        Args: { p_dry_run?: boolean }
        Returns: {
          affected_rows: number
          category: string
          cutoff: string
        }[]
      }
      apply_data_retention_before_whatsapp: {
        Args: { p_dry_run?: boolean }
        Returns: {
          affected_rows: number
          category: string
          cutoff: string
        }[]
      }
      authorize_instagram_connection_admin: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: string
      }
      authorize_instagram_manager: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: string
      }
      authorize_instagram_operator: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: string
      }
      authorize_meta_marketing_connection_admin: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: string
      }
      authorize_whatsapp_connection_admin: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: string
      }
      authorize_whatsapp_operator: {
        Args: {
          p_actor_user_id: string
          p_manage?: boolean
          p_theatre_id: string
        }
        Returns: string
      }
      canonicalize_installed_web_page_url: {
        Args: { input_url: string }
        Returns: string
      }
      canonicalize_knowledge_source_url: {
        Args: { input_url: string }
        Returns: string
      }
      checkpoint_knowledge_sync_run: {
        Args: {
          p_blocked_count: number
          p_changed_count: number
          p_checked_count: number
          p_discovered_count: number
          p_failed_count: number
          p_phase: string
          p_run_id: string
          p_unchanged_count: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          blocked_count: number
          changed_count: number
          checked_count: number
          created_at: string
          deactivated_count: number
          discovered_count: number
          error_code: string | null
          error_details: string | null
          failed_count: number
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          metadata: Json
          source_id: string
          started_at: string | null
          status: string
          theatre_id: string
          trigger: string
          unchanged_count: number
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "knowledge_sync_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_due_knowledge_sync_runs: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          blocked_count: number
          changed_count: number
          checked_count: number
          created_at: string
          deactivated_count: number
          discovered_count: number
          error_code: string | null
          error_details: string | null
          failed_count: number
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          metadata: Json
          source_id: string
          started_at: string | null
          status: string
          theatre_id: string
          trigger: string
          unchanged_count: number
          updated_at: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "knowledge_sync_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_email_sync_run: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: string
      }
      claim_instagram_handoff: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      claim_instagram_inbound_jobs: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          job_id: string
        }[]
      }
      claim_knowledge_domain_fetch_lease: {
        Args: {
          p_domain: string
          p_lease_seconds?: number
          p_max_concurrency?: number
          p_min_interval_ms?: number
          p_worker_id: string
        }
        Returns: {
          lease_id: string
          retry_after_ms: number
        }[]
      }
      claim_meta_marketing_ad_creation: {
        Args: {
          p_actor_user_id: string
          p_call_to_action: string
          p_destination_url: string
          p_headline: string
          p_image_url: string
          p_name: string
          p_page_id: string
          p_primary_text: string
          p_provider_ad_set_id: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      claim_meta_marketing_ad_set_creation: {
        Args: {
          p_actor_user_id: string
          p_age_max: number
          p_age_min: number
          p_countries: string[]
          p_daily_budget_minor: number
          p_end_time: string
          p_expected_currency: string
          p_name: string
          p_provider_campaign_id: string
          p_request_id: string
          p_start_time: string
          p_theatre_id: string
        }
        Returns: Json
      }
      claim_meta_marketing_ad_upload_creation: {
        Args: {
          p_actor_user_id: string
          p_call_to_action: string
          p_destination_url: string
          p_headline: string
          p_image_mime_type: string
          p_image_sha256: string
          p_image_size_bytes: number
          p_name: string
          p_page_id: string
          p_primary_text: string
          p_provider_ad_set_id: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      claim_meta_marketing_campaign_creation: {
        Args: {
          p_actor_user_id: string
          p_name: string
          p_no_special_ad_category_confirmed: boolean
          p_objective: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      claim_whatsapp_handoff: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      claim_whatsapp_inbound_jobs: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          connection_id: string
          job_id: string
          message_id: string
          theatre_id: string
        }[]
      }
      complete_instagram_agent_handoff: {
        Args: {
          p_agent_metadata?: Json
          p_failed?: boolean
          p_job_id: string
          p_outbound_delivery_status?: string
          p_outbound_message_id?: string
          p_reason: string
          p_worker_id: string
        }
        Returns: string
      }
      complete_instagram_agent_reply: {
        Args: {
          p_agent_metadata?: Json
          p_job_id: string
          p_outbound_message_id: string
          p_provider_message_id: string
          p_resolution?: Json
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_instagram_operator_reply: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_outbound_message_id: string
          p_provider_message_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      complete_meta_marketing_ad_creation: {
        Args: {
          p_actor_user_id: string
          p_provider_ad_id: string
          p_provider_creative_id: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      complete_meta_marketing_ad_set_creation: {
        Args: {
          p_actor_user_id: string
          p_provider_ad_set_id: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      complete_meta_marketing_ad_upload_creation: {
        Args: {
          p_actor_user_id: string
          p_provider_ad_id: string
          p_provider_creative_id: string
          p_provider_image_hash: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      complete_meta_marketing_campaign_creation: {
        Args: {
          p_actor_user_id: string
          p_provider_campaign_id: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      complete_whatsapp_agent_handoff: {
        Args: {
          p_agent_metadata?: Json
          p_failed?: boolean
          p_job_id: string
          p_outbound_delivery_status?: string
          p_outbound_message_id?: string
          p_reason: string
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_whatsapp_agent_reply: {
        Args: {
          p_agent_metadata?: Json
          p_job_id: string
          p_outbound_message_id: string
          p_provider_message_id: string
          p_resolution?: Json
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_whatsapp_conversation_turn: {
        Args: {
          p_agent_metadata?: Json
          p_job_id: string
          p_outbound_message_id: string
          p_provider_message_id: string
          p_resolution?: Json
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_whatsapp_conversation_turn_handoff: {
        Args: {
          p_agent_metadata?: Json
          p_failed?: boolean
          p_job_id: string
          p_outbound_delivery_status?: string
          p_outbound_message_id?: string
          p_reason: string
          p_worker_id: string
        }
        Returns: string
      }
      complete_whatsapp_operator_reply: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_outbound_message_id: string
          p_provider_message_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      consume_security_rate_limit: {
        Args: {
          p_key_hash: string
          p_limit: number
          p_scope: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      current_account_ids: { Args: never; Returns: string[] }
      current_profile_id: { Args: never; Returns: string }
      current_theatre_id: { Args: never; Returns: string }
      current_theatre_ids: { Args: never; Returns: string[] }
      current_user_theatre_id: { Args: never; Returns: string }
      defer_whatsapp_conversation_turn: {
        Args: { p_job_id: string; p_reason?: string; p_worker_id: string }
        Returns: boolean
      }
      delete_email_threads_from_talia: {
        Args: { p_theatre_id: string; p_thread_ids: string[] }
        Returns: number
      }
      disconnect_instagram_connection: {
        Args: {
          p_actor_user_id: string
          p_connection_id: string
          p_provider_error_code?: string | null
          p_provider_revoked?: boolean
          p_theatre_id: string
        }
        Returns: string
      }
      disconnect_meta_marketing_connection: {
        Args: {
          p_actor_user_id: string
          p_connection_id: string
          p_provider_error_code?: string
          p_provider_revoked?: boolean
          p_theatre_id: string
        }
        Returns: string
      }
      disconnect_whatsapp_connection: {
        Args: {
          p_actor_user_id: string
          p_connection_id: string
          p_provider_error_code?: string | null
          p_provider_unsubscribed?: boolean
          p_theatre_id: string
        }
        Returns: string
      }
      fail_instagram_operator_reply: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_delivery_status: string
          p_error_code: string
          p_outbound_message_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      fail_meta_marketing_ad_creation: {
        Args: {
          p_actor_user_id: string
          p_error_code: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      fail_meta_marketing_ad_set_creation: {
        Args: {
          p_actor_user_id: string
          p_error_code: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      fail_meta_marketing_campaign_creation: {
        Args: {
          p_actor_user_id: string
          p_error_code: string
          p_request_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      fail_whatsapp_operator_reply: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_delivery_status: string
          p_error_code: string
          p_outbound_message_id: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      finish_email_sync_run: {
        Args: {
          p_checked_count?: number
          p_error_code?: string
          p_error_message?: string
          p_failed_count?: number
          p_imported_count?: number
          p_inspected_count?: number
          p_processed_count?: number
          p_run_id: string
          p_skipped_count?: number
          p_status: string
          p_synced_count?: number
          p_worker_id: string
        }
        Returns: boolean
      }
      finish_knowledge_sync_run: {
        Args: {
          p_blocked_count?: number
          p_changed_count?: number
          p_checked_count?: number
          p_deactivated_count?: number
          p_discovered_count?: number
          p_error_code?: string
          p_error_details?: string
          p_failed_count?: number
          p_run_id: string
          p_status: string
          p_unchanged_count?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          blocked_count: number
          changed_count: number
          checked_count: number
          created_at: string
          deactivated_count: number
          discovered_count: number
          error_code: string | null
          error_details: string | null
          failed_count: number
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          metadata: Json
          source_id: string
          started_at: string | null
          status: string
          theatre_id: string
          trigger: string
          unchanged_count: number
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "knowledge_sync_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_whatsapp_inbound_job: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_job_id: string
          p_retry_delay_seconds?: number
          p_status: string
          p_worker_id: string
        }
        Returns: boolean
      }
      get_backstage_response_trace_metrics: {
        Args: { p_theatre_id: string }
        Returns: {
          fallbacks: number
          low_confidence: number
          response_negative: number
          response_positive: number
          session_resolved: number
          session_unresolved: number
          with_sources: number
          without_sources: number
        }[]
      }
      get_backstage_response_traces: {
        Args: {
          p_channel?: string | null
          p_limit?: number
          p_offset?: number
          p_theatre_id: string
        }
        Returns: Json
      }
      get_instagram_connection_credentials: {
        Args: { p_instagram_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_instagram_connection_disconnect_context: {
        Args: {
          p_actor_user_id: string
          p_connection_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      get_instagram_connection_summary: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_instagram_conversation_detail: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      get_instagram_conversation_history: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_theatre_id: string
        }
        Returns: Json
      }
      get_instagram_inbound_job_context: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: Json
      }
      get_knowledge_web_limits: {
        Args: { p_theatre_id: string }
        Returns: {
          max_documents: number
          max_manual_syncs_per_day: number
          max_pages_per_source: number
          max_sources: number
        }[]
      }
      get_knowledge_web_operational_alerts: {
        Args: {
          p_limit?: number
          p_now?: string
          p_theatre_id?: string
          p_warning_ratio?: number
        }
        Returns: {
          alert_key: string
          current_value: number
          error_code: string | null
          kind: string
          latest_status: string | null
          limit_value: number
          occurred_at: string
          ratio: number
          severity: string
          source_id: string | null
          source_name: string | null
          theatre_id: string
          theatre_name: string
        }[]
      }
      get_meta_marketing_connection_credentials: {
        Args: { p_ad_account_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_meta_marketing_connection_summary: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_meta_marketing_dashboard_snapshot: {
        Args: {
          p_actor_user_id: string
          p_period: string
          p_theatre_id: string
        }
        Returns: Json
      }
      get_meta_marketing_sync_context: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_tenant_usage_totals: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_theatre_id: string
        }
        Returns: {
          ai_calls: number
          conversations: number
          estimated_cost_cents: number
          fallbacks: number
          input_tokens: number
          limit_exceeded_events: number
          messages: number
          output_tokens: number
          resolutions: number
          tool_calls: number
          voice_minutes: number
        }[]
      }
      get_whatsapp_connection_credentials: {
        Args: { p_phone_number_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_whatsapp_connection_disconnect_context: {
        Args: {
          p_actor_user_id: string
          p_connection_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      get_whatsapp_connection_summary: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      get_whatsapp_conversation_history: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_theatre_id: string
        }
        Returns: Json
      }
      get_whatsapp_handoff_detail: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: Json
      }
      get_whatsapp_handoff_queue: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_theatre_id: string
        }
        Returns: Json
      }
      get_whatsapp_inbound_job_context: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: Json
      }
      ignore_instagram_handoff: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      ignore_whatsapp_handoff: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      increment_tenant_usage_daily: {
        Args: {
          p_channel: string
          p_cost_estimate_cents: number
          p_date: string
          p_event_type: string
          p_input_tokens: number
          p_module_key: string
          p_output_tokens: number
          p_quantity: number
          p_theatre_id: string
        }
        Returns: undefined
      }
      ingest_instagram_message: {
        Args: {
          p_body_text: string
          p_context_provider_message_id?: string
          p_instagram_user_id: string
          p_message_type: string
          p_metadata?: Json
          p_processable?: boolean
          p_provider_message_id: string
          p_provider_timestamp: string
          p_sender_igsid: string
        }
        Returns: {
          inbound_job_id: string
          inbound_message_id: string
          outcome: string
          resolved_theatre_id: string
        }[]
      }
      ingest_whatsapp_message: {
        Args: {
          p_body_text: string
          p_context_provider_message_id?: string
          p_message_type: string
          p_metadata?: Json
          p_phone_number_id: string
          p_processable?: boolean
          p_profile_name: string
          p_provider_message_id: string
          p_provider_timestamp: string
          p_sender_wa_id: string
          p_waba_id: string
        }
        Returns: {
          inbound_job_id: string
          inbound_message_id: string
          outcome: string
          resolved_theatre_id: string
        }[]
      }
      knowledge_web_limit_value: {
        Args: {
          p_default: number
          p_key: string
          p_limits: Json
          p_maximum: number
          p_minimum: number
        }
        Returns: number
      }
      list_meta_marketing_eligible_traffic_ad_sets: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      list_meta_marketing_eligible_traffic_campaigns: {
        Args: { p_actor_user_id: string; p_theatre_id: string }
        Returns: Json
      }
      mark_whatsapp_agent_send_started: {
        Args: {
          p_job_id: string
          p_outbound_message_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      match_knowledge: {
        Args: {
          p_match_count?: number
          p_min_similarity?: number
          p_query_embedding: string
          p_theatre_id: string
        }
        Returns: {
          answer: string
          category: string
          chunk_index: number
          id: string
          language: string
          metadata: Json
          priority: number
          question: string
          record_type: string
          similarity: number
          source_id: string
        }[]
      }
      match_knowledge_chunks: {
        Args: {
          p_match_count?: number
          p_min_similarity?: number
          p_query_embedding: string
          p_theatre_id: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          language: string
          metadata: Json
          similarity: number
          source_id: string
        }[]
      }
      next_knowledge_sync_at: {
        Args: { from_time?: string; refresh_interval: string }
        Returns: string
      }
      prepare_instagram_agent_reply: {
        Args: {
          p_agent_metadata?: Json
          p_job_id: string
          p_reply: string
          p_worker_id: string
        }
        Returns: Json
      }
      prepare_instagram_operator_reply: {
        Args: {
          p_actor_user_id: string
          p_body_text: string
          p_conversation_id: string
          p_idempotency_key: string
          p_theatre_id: string
        }
        Returns: Json
      }
      prepare_whatsapp_agent_reply: {
        Args: {
          p_agent_metadata?: Json
          p_job_id: string
          p_reply: string
          p_worker_id: string
        }
        Returns: Json
      }
      prepare_whatsapp_conversation_turn: {
        Args: {
          p_agent_metadata?: Json
          p_job_id: string
          p_reply: string
          p_worker_id: string
        }
        Returns: Json
      }
      prepare_whatsapp_operator_reply: {
        Args: {
          p_actor_user_id: string
          p_body_text: string
          p_conversation_id: string
          p_idempotency_key: string
          p_theatre_id: string
        }
        Returns: Json
      }
      reconcile_whatsapp_delivery_status: {
        Args: {
          p_delivery_status: string
          p_error_code?: string
          p_metadata?: Json
          p_phone_number_id: string
          p_provider_message_id: string
          p_provider_timestamp: string
          p_waba_id: string
        }
        Returns: {
          outbound_message_id: string
          outcome: string
          resolved_theatre_id: string
        }[]
      }
      record_meta_marketing_sync_failure: {
        Args: {
          p_actor_user_id: string
          p_connection_id: string
          p_error_code: string
          p_period: string
          p_theatre_id: string
        }
        Returns: boolean
      }
      record_widget_installation: {
        Args: { p_origin: string; p_theatre_id: string }
        Returns: boolean
      }
      release_instagram_conversation: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      release_knowledge_domain_fetch_lease: {
        Args: { p_lease_id: string; p_worker_id: string }
        Returns: boolean
      }
      release_whatsapp_conversation: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      renew_knowledge_sync_run_lease: {
        Args: {
          p_lease_seconds?: number
          p_run_id: string
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          blocked_count: number
          changed_count: number
          checked_count: number
          created_at: string
          deactivated_count: number
          discovered_count: number
          error_code: string | null
          error_details: string | null
          failed_count: number
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          metadata: Json
          source_id: string
          started_at: string | null
          status: string
          theatre_id: string
          trigger: string
          unchanged_count: number
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "knowledge_sync_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_knowledge_chunks: {
        Args: {
          p_chunks: Json
          p_document_id: string
          p_source_id: string
          p_theatre_id: string
        }
        Returns: number
      }
      replace_meta_marketing_campaign_snapshot: {
        Args: {
          p_actor_user_id: string
          p_campaigns: Json
          p_connection_id: string
          p_daily_insights: Json
          p_period: string
          p_summary: Json
          p_theatre_id: string
        }
        Returns: number
      }
      replace_programme_events: {
        Args: {
          p_document_id: string
          p_events: Json
          p_source_id: string
          p_theatre_id: string
        }
        Returns: number
      }
      resolve_whatsapp_handoff: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      retry_instagram_agent_reply: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_retry_delay_seconds?: number
          p_worker_id: string
        }
        Returns: string
      }
      retry_whatsapp_agent_reply: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_outbound_message_id: string
          p_retry_delay_seconds?: number
          p_worker_id: string
        }
        Returns: boolean
      }
      retry_whatsapp_conversation_turn: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_outbound_message_id?: string
          p_retry_delay_seconds?: number
          p_worker_id: string
        }
        Returns: string
      }
      save_instagram_connection: {
        Args: {
          p_account_type: string
          p_actor_user_id: string
          p_credential_metadata: Json
          p_instagram_user_id: string
          p_scopes: string[]
          p_theatre_id: string
          p_username: string
        }
        Returns: string
      }
      save_meta_marketing_connection: {
        Args: {
          p_actor_user_id: string
          p_ad_account_currency: string | null
          p_ad_account_id: string
          p_ad_account_name: string
          p_business_id: string
          p_business_name: string
          p_credential_metadata: Json
          p_meta_user_id: string
          p_scopes: string[]
          p_theatre_id: string
        }
        Returns: string
      }
      save_whatsapp_embedded_connection: {
        Args: {
          p_actor_user_id: string
          p_business_id: string
          p_credential_metadata: Json
          p_display_phone_number: string | null
          p_error_code?: string | null
          p_phone_number_id: string
          p_status: string
          p_theatre_id: string
          p_verified_name: string | null
          p_waba_id: string
        }
        Returns: string
      }
      search_knowledge_text: {
        Args: { p_match_count?: number; p_query: string; p_theatre_id: string }
        Returns: {
          answer: string
          category: string
          chunk_index: number
          id: string
          language: string
          metadata: Json
          priority: number
          question: string
          rank: number
          record_type: string
          source_id: string
        }[]
      }
      search_programme_events: {
        Args: {
          p_include_expired?: boolean
          p_match_count?: number
          p_query: string
          p_reference_date?: string
          p_theatre_id: string
        }
        Returns: {
          answer: string
          category: string
          chunk_index: number
          id: string
          language: string
          metadata: Json
          priority: number
          question: string
          rank: number
          record_type: string
          source_id: string
        }[]
      }
      set_knowledge_web_sync_enabled: {
        Args: { p_enabled: boolean; p_source_id: string; p_theatre_id: string }
        Returns: {
          config: Json
          created_at: string
          id: string
          last_error: string | null
          last_sync_run_id: string | null
          last_synced_at: string | null
          name: string
          next_sync_at: string | null
          refresh_interval: string
          source_url: string | null
          status: string
          sync_enabled: boolean
          theatre_id: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "knowledge_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_instagram_agent_send: {
        Args: {
          p_job_id: string
          p_outbound_message_id: string
          p_worker_id: string
        }
        Returns: string
      }
      start_instagram_operator_reply_send: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_outbound_message_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      start_whatsapp_conversation_turn_send: {
        Args: {
          p_job_id: string
          p_outbound_message_id: string
          p_worker_id: string
        }
        Returns: string
      }
      start_whatsapp_operator_reply_send: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_outbound_message_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      take_over_instagram_conversation: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
      take_over_whatsapp_conversation: {
        Args: {
          p_actor_user_id: string
          p_conversation_id: string
          p_theatre_id: string
        }
        Returns: string
      }
    }
    Enums: {
      message_role: "user" | "assistant"
      user_role: "admin" | "viewer" | "owner" | "operator" | "analyst"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      user_role: ["admin", "viewer", "owner", "operator", "analyst"],
    },
  },
} as const
