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
      accounts: {
        Row: {
          billing_email: string | null
          billing_currency: string
          created_at: string
          id: string
          metadata: Json
          market_country_code: string | null
          name: string
          plan: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          billing_currency?: string
          created_at?: string
          id?: string
          metadata?: Json
          market_country_code?: string | null
          name: string
          plan?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          billing_currency?: string
          created_at?: string
          id?: string
          metadata?: Json
          market_country_code?: string | null
          name?: string
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
      knowledge_chunks: {
        Row: {
          active: boolean
          chunk_index: number
          content: string
          created_at: string
          document_id: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_updated_at: string | null
          embedding: string | null
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
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          embedding?: string | null
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
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          embedding?: string | null
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
          theatre_id: string
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
          theatre_id: string
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
          theatre_id?: string
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
          voice_forwarding_notes: string | null
          voice_operational_status: string
          voice_phone_mode: string
          voice_phone_number: string | null
          voice_phone_provider: string
          voice_public_phone_number: string | null
          voice_system_prompt: string | null
          voice_temperature: number
          voice_tone: string
          webhook_secret: string | null
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
          voice_forwarding_notes?: string | null
          voice_operational_status?: string
          voice_phone_mode?: string
          voice_phone_number?: string | null
          voice_phone_provider?: string
          voice_public_phone_number?: string | null
          voice_system_prompt?: string | null
          voice_temperature?: number
          voice_tone?: string
          webhook_secret?: string | null
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
          voice_forwarding_notes?: string | null
          voice_operational_status?: string
          voice_phone_mode?: string
          voice_phone_number?: string | null
          voice_phone_provider?: string
          voice_public_phone_number?: string | null
          voice_system_prompt?: string | null
          voice_temperature?: number
          voice_tone?: string
          webhook_secret?: string | null
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
    }
    Functions: {
      apply_chat_message_top_up: {
        Args: {
          p_checkout_session_id: string
          p_messages: number
          p_subscription_id: string
        }
        Returns: boolean
      }
      anonymize_web_usage_identifiers: {
        Args: {
          p_session_id: string
          p_theatre_id: string
        }
        Returns: {
          affected_rows: number
          category: string
        }[]
      }
      record_widget_installation: {
        Args: {
          p_origin: string
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
      claim_email_sync_run: {
        Args: {
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: string | null
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
      current_theatre_id: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      get_backstage_response_trace_metrics: {
        Args: {
          p_theatre_id: string
        }
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
      set_knowledge_web_sync_enabled: {
        Args: {
          p_enabled: boolean
          p_source_id: string
          p_theatre_id: string
        }
        Returns: Database["public"]["Tables"]["knowledge_sources"]["Row"]
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
          inbound_job_id: string | null
          inbound_message_id: string | null
          outcome: string
          resolved_theatre_id: string | null
        }[]
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
          source_id: string | null
        }[]
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
          chunk_index: number | null
          id: string
          language: string
          metadata: Json
          priority: number
          question: string | null
          record_type: string
          similarity: number
          source_id: string | null
        }[]
      }
      search_knowledge_text: {
        Args: {
          p_match_count?: number
          p_query: string
          p_theatre_id: string
        }
        Returns: {
          answer: string
          category: string
          chunk_index: number | null
          id: string
          language: string
          metadata: Json
          priority: number
          question: string | null
          rank: number
          record_type: string
          source_id: string | null
        }[]
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
