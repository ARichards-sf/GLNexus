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
      account_snapshots: {
        Row: {
          account_id: string
          advisor_id: string
          balance: number
          created_at: string
          id: string
          snapshot_date: string
        }
        Insert: {
          account_id: string
          advisor_id: string
          balance?: number
          created_at?: string
          id?: string
          snapshot_date?: string
        }
        Update: {
          account_id?: string
          advisor_id?: string
          balance?: number
          created_at?: string
          id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "contact_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_admin_relationships: {
        Row: {
          admin_id: string
          advisor_id: string
          created_at: string
          id: string
        }
        Insert: {
          admin_id: string
          advisor_id: string
          created_at?: string
          id?: string
        }
        Update: {
          admin_id?: string
          advisor_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          completed_at: string | null
          function_name: string
          id: string
          message: string | null
          records_processed: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          function_name: string
          id?: string
          message?: string | null
          records_processed?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          function_name?: string
          id?: string
          message?: string | null
          records_processed?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          advisor_id: string
          created_at: string
          description: string | null
          end_time: string
          event_type: string
          household_id: string | null
          id: string
          meeting_context: string | null
          prospect_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          advisor_id: string
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string
          household_id?: string | null
          id?: string
          meeting_context?: string | null
          prospect_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          advisor_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string
          household_id?: string | null
          id?: string
          meeting_context?: string | null
          prospect_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "active_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_notes: {
        Row: {
          advisor_id: string
          advisor_name: string | null
          created_at: string
          date: string
          household_id: string
          id: string
          summary: string
          type: string
        }
        Insert: {
          advisor_id: string
          advisor_name?: string | null
          created_at?: string
          date?: string
          household_id: string
          id?: string
          summary: string
          type: string
        }
        Update: {
          advisor_id?: string
          advisor_name?: string | null
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "active_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_accounts: {
        Row: {
          account_class: string | null
          account_name: string
          account_number: string | null
          account_registration: string | null
          account_type: string
          advisor_id: string
          archived_at: string | null
          balance: number
          br_suitability: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          data_source: string | null
          description: string | null
          id: string
          institution: string | null
          lpl_last_updated: string | null
          lpl_linking_status: string | null
          lpl_net_revenues: number | null
          lpl_type: string | null
          member_id: string
          objective: string | null
          status: string
          tier_schedule: string | null
          updated_at: string
        }
        Insert: {
          account_class?: string | null
          account_name: string
          account_number?: string | null
          account_registration?: string | null
          account_type?: string
          advisor_id: string
          archived_at?: string | null
          balance?: number
          br_suitability?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          id?: string
          institution?: string | null
          lpl_last_updated?: string | null
          lpl_linking_status?: string | null
          lpl_net_revenues?: number | null
          lpl_type?: string | null
          member_id: string
          objective?: string | null
          status?: string
          tier_schedule?: string | null
          updated_at?: string
        }
        Update: {
          account_class?: string | null
          account_name?: string
          account_number?: string | null
          account_registration?: string | null
          account_type?: string
          advisor_id?: string
          archived_at?: string | null
          balance?: number
          br_suitability?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          id?: string
          institution?: string | null
          lpl_last_updated?: string | null
          lpl_linking_status?: string | null
          lpl_net_revenues?: number | null
          lpl_type?: string | null
          member_id?: string
          objective?: string | null
          status?: string
          tier_schedule?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_accounts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_snapshots: {
        Row: {
          advisor_id: string
          created_at: string
          household_count: number
          id: string
          snapshot_date: string
          total_aum: number
        }
        Insert: {
          advisor_id: string
          created_at?: string
          household_count?: number
          id?: string
          snapshot_date?: string
          total_aum?: number
        }
        Update: {
          advisor_id?: string
          created_at?: string
          household_count?: number
          id?: string
          snapshot_date?: string
          total_aum?: number
        }
        Relationships: []
      }
      deletion_audit_log: {
        Row: {
          advisor_id: string | null
          deleted_at: string
          deleted_by: string
          deletion_reason: string
          id: string
          record_id: string
          record_snapshot: Json
          record_type: string
        }
        Insert: {
          advisor_id?: string | null
          deleted_at?: string
          deleted_by: string
          deletion_reason: string
          id?: string
          record_id: string
          record_snapshot: Json
          record_type: string
        }
        Update: {
          advisor_id?: string | null
          deleted_at?: string
          deleted_by?: string
          deletion_reason?: string
          id?: string
          record_id?: string
          record_snapshot?: Json
          record_type?: string
        }
        Relationships: []
      }
      firm_memberships: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          is_lead_advisor: boolean
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          is_lead_advisor?: boolean
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          is_lead_advisor?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_memberships_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          accent_color: string | null
          address_line1: string | null
          address_line2: string | null
          allow_book_sharing: boolean
          bd_number: string | null
          city: string | null
          crd_number: string | null
          created_at: string
          email: string | null
          founded_year: number | null
          id: string
          is_gl_internal: boolean
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          secondary_color: string | null
          state: string | null
          total_aum: number | null
          website: string | null
          zip: string | null
        }
        Insert: {
          accent_color?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_book_sharing?: boolean
          bd_number?: string | null
          city?: string | null
          crd_number?: string | null
          created_at?: string
          email?: string | null
          founded_year?: number | null
          id?: string
          is_gl_internal?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          secondary_color?: string | null
          state?: string | null
          total_aum?: number | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          accent_color?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_book_sharing?: boolean
          bd_number?: string | null
          city?: string | null
          crd_number?: string | null
          created_at?: string
          email?: string | null
          founded_year?: number | null
          id?: string
          is_gl_internal?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          secondary_color?: string | null
          state?: string | null
          total_aum?: number | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      household_members: {
        Row: {
          advisor_id: string
          archived_at: string | null
          archived_reason: string | null
          company: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          household_id: string | null
          id: string
          job_title: string | null
          last_contacted: string | null
          last_name: string
          phone: string | null
          relationship: string
        }
        Insert: {
          advisor_id: string
          archived_at?: string | null
          archived_reason?: string | null
          company?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          household_id?: string | null
          id?: string
          job_title?: string | null
          last_contacted?: string | null
          last_name: string
          phone?: string | null
          relationship: string
        }
        Update: {
          advisor_id?: string
          archived_at?: string | null
          archived_reason?: string | null
          company?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          household_id?: string | null
          id?: string
          job_title?: string | null
          last_contacted?: string | null
          last_name?: string
          phone?: string | null
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "active_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_snapshots: {
        Row: {
          advisor_id: string
          created_at: string
          household_id: string
          id: string
          snapshot_date: string
          total_aum: number
        }
        Insert: {
          advisor_id: string
          created_at?: string
          household_id: string
          id?: string
          snapshot_date?: string
          total_aum?: number
        }
        Update: {
          advisor_id?: string
          created_at?: string
          household_id?: string
          id?: string
          snapshot_date?: string
          total_aum?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_snapshots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "active_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_snapshots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          advisor_id: string
          annual_review_date: string | null
          archived_at: string | null
          archived_reason: string | null
          created_at: string
          id: string
          investment_objective: string | null
          last_review_date: string | null
          name: string
          next_action: string | null
          next_action_date: string | null
          risk_tolerance: string
          status: string
          total_aum: number
          updated_at: string
          wealth_tier: string | null
        }
        Insert: {
          advisor_id: string
          annual_review_date?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string
          id?: string
          investment_objective?: string | null
          last_review_date?: string | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          risk_tolerance?: string
          status?: string
          total_aum?: number
          updated_at?: string
          wealth_tier?: string | null
        }
        Update: {
          advisor_id?: string
          annual_review_date?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string
          id?: string
          investment_objective?: string | null
          last_review_date?: string | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          risk_tolerance?: string
          status?: string
          total_aum?: number
          updated_at?: string
          wealth_tier?: string | null
        }
        Relationships: []
      }
      internal_user_firm_assignments: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          internal_user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          internal_user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          internal_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_user_firm_assignments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          firm_id: string | null
          full_name: string | null
          id: string
          is_gl_internal: boolean
          is_internal: boolean
          last_sign_in: string | null
          office_location: string | null
          platform_role: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          firm_id?: string | null
          full_name?: string | null
          id?: string
          is_gl_internal?: boolean
          is_internal?: boolean
          last_sign_in?: string | null
          office_location?: string | null
          platform_role?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          firm_id?: string | null
          full_name?: string | null
          id?: string
          is_gl_internal?: boolean
          is_internal?: boolean
          last_sign_in?: string | null
          office_location?: string | null
          platform_role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          advisor_id: string
          company: string | null
          converted_at: string | null
          converted_household_id: string | null
          created_at: string
          email: string | null
          estimated_aum: number | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string
          lost_reason: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string
          referred_by: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          advisor_id: string
          company?: string | null
          converted_at?: string | null
          converted_household_id?: string | null
          created_at?: string
          email?: string | null
          estimated_aum?: number | null
          first_name: string
          id?: string
          job_title?: string | null
          last_name: string
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          referred_by?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          advisor_id?: string
          company?: string | null
          converted_at?: string | null
          converted_household_id?: string | null
          created_at?: string
          email?: string | null
          estimated_aum?: number | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          referred_by?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_converted_household_id_fkey"
            columns: ["converted_household_id"]
            isOneToOne: false
            referencedRelation: "active_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_converted_household_id_fkey"
            columns: ["converted_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          request_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      service_request_read_status: {
        Row: {
          id: string
          last_read_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          request_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          account_id: string | null
          account_institution: string | null
          account_type: string | null
          advisor_id: string
          category: string
          created_at: string
          description: string
          file_paths: string[] | null
          household_aum: number | null
          household_id: string | null
          household_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_institution?: string | null
          account_type?: string | null
          advisor_id: string
          category: string
          created_at?: string
          description: string
          file_paths?: string[] | null
          household_aum?: number | null
          household_id?: string | null
          household_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_institution?: string | null
          account_type?: string | null
          advisor_id?: string
          category?: string
          created_at?: string
          description?: string
          file_paths?: string[] | null
          household_aum?: number | null
          household_id?: string | null
          household_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_notifications: {
        Row: {
          created_at: string
          id: string
          read: boolean
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read?: boolean
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read?: boolean
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          advisor_id: string
          assigned_to: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          description: string | null
          dismissed_at: string | null
          due_date: string | null
          household_id: string | null
          id: string
          metadata: Json | null
          priority: string
          status: string
          task_type: string
          title: string
        }
        Insert: {
          advisor_id: string
          assigned_to: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          dismissed_at?: string | null
          due_date?: string | null
          household_id?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          task_type?: string
          title: string
        }
        Update: {
          advisor_id?: string
          assigned_to?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          dismissed_at?: string | null
          due_date?: string | null
          household_id?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "active_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vpm_firm_assignments: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          vpm_user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          vpm_user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          vpm_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vpm_firm_assignments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_households: {
        Row: {
          advisor_id: string | null
          annual_review_date: string | null
          archived_at: string | null
          archived_reason: string | null
          created_at: string | null
          id: string | null
          investment_objective: string | null
          last_review_date: string | null
          name: string | null
          next_action: string | null
          next_action_date: string | null
          risk_tolerance: string | null
          status: string | null
          total_aum: number | null
          updated_at: string | null
          wealth_tier: string | null
        }
        Insert: {
          advisor_id?: string | null
          annual_review_date?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string | null
          id?: string | null
          investment_objective?: string | null
          last_review_date?: string | null
          name?: string | null
          next_action?: string | null
          next_action_date?: string | null
          risk_tolerance?: string | null
          status?: string | null
          total_aum?: number | null
          updated_at?: string | null
          wealth_tier?: string | null
        }
        Update: {
          advisor_id?: string | null
          annual_review_date?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string | null
          id?: string | null
          investment_objective?: string | null
          last_review_date?: string | null
          name?: string | null
          next_action?: string | null
          next_action_date?: string | null
          risk_tolerance?: string | null
          status?: string | null
          total_aum?: number | null
          updated_at?: string | null
          wealth_tier?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_daily_snapshots: { Args: never; Returns: undefined }
      get_accessible_advisor_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_developer: { Args: { _user_id: string }; Returns: boolean }
      is_gl_internal: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
