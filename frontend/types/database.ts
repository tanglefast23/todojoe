/**
 * Supabase database types for JVTodo
 * Auto-generated from Supabase project: bijgirpowxurnyaccqhs
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      gmail_messages: {
        Row: {
          body_preview: string | null
          cached_at: string
          from_email: string | null
          from_name: string | null
          gmail_id: string
          id: string
          is_unread: boolean | null
          labels: string[] | null
          received_at: string
          snippet: string | null
          subject: string | null
          thread_id: string
        }
        Insert: {
          body_preview?: string | null
          cached_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_id: string
          id?: string
          is_unread?: boolean | null
          labels?: string[] | null
          received_at: string
          snippet?: string | null
          subject?: string | null
          thread_id: string
        }
        Update: {
          body_preview?: string | null
          cached_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_id?: string
          id?: string
          is_unread?: boolean | null
          labels?: string[] | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_events: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          end_at: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          last_synced_at: string | null
          scheduled_at: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          scheduled_at: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          scheduled_at?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          attachment_url: string | null
          completed_at: string | null
          created_at: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper type for extracting table row types
type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Update"]

// Convenience aliases
export type TaskRow = Tables<"tasks">
export type ScheduledEventRow = Tables<"scheduled_events">
export type GmailMessageRow = Tables<"gmail_messages">
export type GoogleTokenRow = Tables<"google_tokens">
export type AppSettingRow = Tables<"app_settings">
