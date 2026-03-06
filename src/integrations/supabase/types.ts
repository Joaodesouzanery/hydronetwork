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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_approvals: {
        Row: {
          admin_user_id: string
          approved: boolean
          created_at: string | null
          id: string
          notes: string | null
          pending_action_id: string
        }
        Insert: {
          admin_user_id: string
          approved: boolean
          created_at?: string | null
          id?: string
          notes?: string | null
          pending_action_id: string
        }
        Update: {
          admin_user_id?: string
          approved?: boolean
          created_at?: string | null
          id?: string
          notes?: string | null
          pending_action_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_approvals_pending_action_id_fkey"
            columns: ["pending_action_id"]
            isOneToOne: false
            referencedRelation: "pending_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_config: {
        Row: {
          ativo: boolean | null
          condicao: Json
          created_at: string | null
          destinatarios: string[]
          id: string
          obra_id: string | null
          tipo_alerta: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          condicao: Json
          created_at?: string | null
          destinatarios: string[]
          id?: string
          obra_id?: string | null
          tipo_alerta: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          condicao?: Json
          created_at?: string | null
          destinatarios?: string[]
          id?: string
          obra_id?: string | null
          tipo_alerta?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_config_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_historico: {
        Row: {
          alerta_config_id: string
          enviado_em: string | null
          id: string
          justificado_em: string | null
          justificado_por_user_id: string | null
          justificativa: string | null
          mensagem: string
          obra_id: string
        }
        Insert: {
          alerta_config_id: string
          enviado_em?: string | null
          id?: string
          justificado_em?: string | null
          justificado_por_user_id?: string | null
          justificativa?: string | null
          mensagem: string
          obra_id: string
        }
        Update: {
          alerta_config_id?: string
          enviado_em?: string | null
          id?: string
          justificado_em?: string | null
          justificado_por_user_id?: string | null
          justificativa?: string | null
          mensagem?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_historico_alerta_config_id_fkey"
            columns: ["alerta_config_id"]
            isOneToOne: false
            referencedRelation: "alertas_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_historico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      assets_catalog: {
        Row: {
          coordinates: string | null
          created_at: string | null
          created_by_user_id: string
          detailed_location: string | null
          floor: string | null
          id: string
          main_responsible: string | null
          name: string
          project_id: string | null
          sector: string | null
          technical_notes: string | null
          tower: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          coordinates?: string | null
          created_at?: string | null
          created_by_user_id: string
          detailed_location?: string | null
          floor?: string | null
          id?: string
          main_responsible?: string | null
          name: string
          project_id?: string | null
          sector?: string | null
          technical_notes?: string | null
          tower?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          coordinates?: string | null
          created_at?: string | null
          created_by_user_id?: string
          detailed_location?: string | null
          floor?: string | null
          id?: string
          main_responsible?: string | null
          name?: string
          project_id?: string | null
          sector?: string | null
          technical_notes?: string | null
          tower?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_catalog_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          created_at: string
          email: string
          enabled: boolean
          frequency: string
          id: string
          last_sent_at: string | null
          tables: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          enabled?: boolean
          frequency: string
          id?: string
          last_sent_at?: string | null
          tables?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_sent_at?: string | null
          tables?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backups: {
        Row: {
          backup_type: string
          created_at: string | null
          file_path: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          project_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          backup_type: string
          created_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          backup_type?: string
          created_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          bdi_percentage: number | null
          budget_id: string
          created_at: string | null
          description: string
          id: string
          item_number: number
          material_id: string | null
          price_at_creation: number | null
          quantity: number
          subtotal_bdi: number | null
          subtotal_labor: number | null
          subtotal_material: number | null
          total: number | null
          unit: string
          unit_price_labor: number | null
          unit_price_material: number | null
        }
        Insert: {
          bdi_percentage?: number | null
          budget_id: string
          created_at?: string | null
          description: string
          id?: string
          item_number: number
          material_id?: string | null
          price_at_creation?: number | null
          quantity: number
          subtotal_bdi?: number | null
          subtotal_labor?: number | null
          subtotal_material?: number | null
          total?: number | null
          unit: string
          unit_price_labor?: number | null
          unit_price_material?: number | null
        }
        Update: {
          bdi_percentage?: number | null
          budget_id?: string
          created_at?: string | null
          description?: string
          id?: string
          item_number?: number
          material_id?: string | null
          price_at_creation?: number | null
          quantity?: number
          subtotal_bdi?: number | null
          subtotal_labor?: number | null
          subtotal_material?: number | null
          total?: number | null
          unit?: string
          unit_price_labor?: number | null
          unit_price_material?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_number: string | null
          client_contact: string | null
          client_name: string | null
          created_at: string | null
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          status: string
          total_amount: number | null
          total_bdi: number | null
          total_labor: number | null
          total_material: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          budget_number?: string | null
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          total_amount?: number | null
          total_bdi?: number | null
          total_labor?: number | null
          total_material?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          budget_number?: string | null
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          total_amount?: number | null
          total_bdi?: number | null
          total_labor?: number | null
          total_material?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          checklist_id: string
          created_at: string | null
          description: string
          id: string
          responsible_id: string | null
          responsible_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          checklist_id: string
          created_at?: string | null
          description: string
          id?: string
          responsible_id?: string | null
          responsible_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          checklist_id?: string
          created_at?: string | null
          description?: string
          id?: string
          responsible_id?: string | null
          responsible_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          name: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          name: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_lancamentos: {
        Row: {
          categoria: string | null
          created_at: string
          data: string
          descricao: string | null
          id: string
          unidade_id: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cmv_lancamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cobertura_postos: {
        Row: {
          created_at: string
          data: string
          id: string
          posto_id: string
          quantidade_alocada: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          posto_id: string
          quantidade_alocada?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          posto_id?: string
          quantidade_alocada?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobertura_postos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos_cobertura"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_clt: {
        Row: {
          created_at: string
          descanso_entre_jornadas: number
          dias_trabalho_antes_folga: number
          escalas_habilitadas: string[]
          hora_fim_noturno: string
          hora_inicio_noturno: string
          id: string
          intervalo_minimo_4h: number
          intervalo_minimo_6h: number
          jornada_diaria_padrao: number
          jornada_semanal_padrao: number
          limite_horas_extras_dia: number
          percentual_adicional_noturno: number
          percentual_hora_extra_100: number
          percentual_hora_extra_50: number
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descanso_entre_jornadas?: number
          dias_trabalho_antes_folga?: number
          escalas_habilitadas?: string[]
          hora_fim_noturno?: string
          hora_inicio_noturno?: string
          id?: string
          intervalo_minimo_4h?: number
          intervalo_minimo_6h?: number
          jornada_diaria_padrao?: number
          jornada_semanal_padrao?: number
          limite_horas_extras_dia?: number
          percentual_adicional_noturno?: number
          percentual_hora_extra_100?: number
          percentual_hora_extra_50?: number
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descanso_entre_jornadas?: number
          dias_trabalho_antes_folga?: number
          escalas_habilitadas?: string[]
          hora_fim_noturno?: string
          hora_inicio_noturno?: string
          id?: string
          intervalo_minimo_4h?: number
          intervalo_minimo_6h?: number
          jornada_diaria_padrao?: number
          jornada_semanal_padrao?: number
          limite_horas_extras_dia?: number
          percentual_adicional_noturno?: number
          percentual_hora_extra_100?: number
          percentual_hora_extra_50?: number
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_clt_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_reports: {
        Row: {
          address: string
          address_complement: string | null
          client_name: string
          connection_type: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          logo_url: string | null
          materials_used: Json | null
          observations: string | null
          os_number: string
          photos_urls: string[] | null
          project_id: string | null
          report_date: string
          service_category: string | null
          service_type: string
          team_name: string
          updated_at: string | null
          water_meter_number: string
        }
        Insert: {
          address: string
          address_complement?: string | null
          client_name: string
          connection_type?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          logo_url?: string | null
          materials_used?: Json | null
          observations?: string | null
          os_number: string
          photos_urls?: string[] | null
          project_id?: string | null
          report_date?: string
          service_category?: string | null
          service_type: string
          team_name: string
          updated_at?: string | null
          water_meter_number: string
        }
        Update: {
          address?: string
          address_complement?: string | null
          client_name?: string
          connection_type?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          logo_url?: string | null
          materials_used?: Json | null
          observations?: string | null
          os_number?: string
          photos_urls?: string[] | null
          project_id?: string | null
          report_date?: string
          service_category?: string | null
          service_type?: string
          team_name?: string
          updated_at?: string | null
          water_meter_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_sites: {
        Row: {
          address: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          name: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_readings: {
        Row: {
          created_at: string | null
          id: string
          location: string | null
          meter_type: string
          meter_value: number
          notes: string | null
          project_id: string
          reading_date: string
          reading_time: string
          recorded_by_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string | null
          meter_type?: string
          meter_value: number
          notes?: string | null
          project_id: string
          reading_date?: string
          reading_time: string
          recorded_by_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string | null
          meter_type?: string
          meter_value?: number
          notes?: string | null
          project_id?: string
          reading_date?: string
          reading_time?: string
          recorded_by_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_readings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_accounts: {
        Row: {
          city: string | null
          cnpj: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          is_archived: boolean | null
          name: string
          notes: string | null
          sector: string | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          is_archived?: boolean | null
          name: string
          notes?: string | null
          sector?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          is_archived?: boolean | null
          name?: string
          notes?: string | null
          sector?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          account_id: string | null
          activity_type: Database["public"]["Enums"]["crm_activity_type"]
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by_user_id: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          is_recurring: boolean | null
          recurrence_pattern: string | null
          status: Database["public"]["Enums"]["crm_activity_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          activity_type?: Database["public"]["Enums"]["crm_activity_type"]
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_recurring?: boolean | null
          recurrence_pattern?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          activity_type?: Database["public"]["Enums"]["crm_activity_type"]
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_recurring?: boolean | null
          recurrence_pattern?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          account_id: string | null
          created_at: string | null
          created_by_user_id: string
          email: string | null
          full_name: string
          id: string
          is_archived: boolean | null
          job_title: string | null
          notes: string | null
          phone: string | null
          phone_secondary: string | null
          status: Database["public"]["Enums"]["crm_contact_status"] | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          email?: string | null
          full_name: string
          id?: string
          is_archived?: boolean | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          phone_secondary?: string | null
          status?: Database["public"]["Enums"]["crm_contact_status"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_archived?: boolean | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          phone_secondary?: string | null
          status?: Database["public"]["Enums"]["crm_contact_status"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_stage_history: {
        Row: {
          changed_by_user_id: string
          created_at: string | null
          deal_id: string
          from_stage_id: string | null
          id: string
          to_stage_id: string | null
        }
        Insert: {
          changed_by_user_id: string
          created_at?: string | null
          deal_id: string
          from_stage_id?: string | null
          id?: string
          to_stage_id?: string | null
        }
        Update: {
          changed_by_user_id?: string
          created_at?: string | null
          deal_id?: string
          from_stage_id?: string | null
          id?: string
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          account_id: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by_user_id: string
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          name: string
          notes: string | null
          probability: number | null
          stage_id: string | null
          status: Database["public"]["Enums"]["crm_deal_status"] | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          notes?: string | null
          probability?: number | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["crm_deal_status"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          notes?: string | null
          probability?: number | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["crm_deal_status"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_history: {
        Row: {
          action: string
          created_at: string | null
          created_by_user_id: string
          entity_id: string
          entity_type: string
          id: string
          new_values: Json | null
          notes: string | null
          old_values: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by_user_id: string
          entity_id: string
          entity_type: string
          id?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by_user_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
        }
        Relationships: []
      }
      crm_pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          created_by_user_id: string
          default_probability: number | null
          id: string
          is_default: boolean | null
          name: string
          position: number
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by_user_id: string
          default_probability?: number | null
          id?: string
          is_default?: boolean | null
          name: string
          position?: number
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by_user_id?: string
          default_probability?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          position?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_keywords: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          keyword_type: string
          keyword_value: string
          synonyms: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          keyword_type: string
          keyword_value: string
          synonyms?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          keyword_type?: string
          keyword_value?: string
          synonyms?: string[] | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          construction_site_id: string
          created_at: string | null
          executed_by_user_id: string
          general_observations: string | null
          gps_location: string | null
          humidity: number | null
          id: string
          occurrences_summary: string | null
          project_id: string
          report_date: string
          service_front_id: string
          temperature: number | null
          terrain_condition: string | null
          updated_at: string | null
          visits: string | null
          weather_description: string | null
          will_rain: boolean | null
          wind_speed: number | null
        }
        Insert: {
          construction_site_id: string
          created_at?: string | null
          executed_by_user_id: string
          general_observations?: string | null
          gps_location?: string | null
          humidity?: number | null
          id?: string
          occurrences_summary?: string | null
          project_id: string
          report_date?: string
          service_front_id: string
          temperature?: number | null
          terrain_condition?: string | null
          updated_at?: string | null
          visits?: string | null
          weather_description?: string | null
          will_rain?: boolean | null
          wind_speed?: number | null
        }
        Update: {
          construction_site_id?: string
          created_at?: string | null
          executed_by_user_id?: string
          general_observations?: string | null
          gps_location?: string | null
          humidity?: number | null
          id?: string
          occurrences_summary?: string | null
          project_id?: string
          report_date?: string
          service_front_id?: string
          temperature?: number | null
          terrain_condition?: string | null
          updated_at?: string | null
          visits?: string | null
          weather_description?: string | null
          will_rain?: boolean | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_configs: {
        Row: {
          created_at: string
          description: string | null
          global_filters: Json | null
          id: string
          is_default: boolean | null
          layout: Json | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          global_filters?: Json | null
          id?: string
          is_default?: boolean | null
          layout?: Json | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          global_filters?: Json | null
          id?: string
          is_default?: boolean | null
          layout?: Json | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string
          dashboard_id: string
          data_source: string | null
          filters: Json | null
          height: number | null
          id: string
          position_x: number | null
          position_y: number | null
          title: string
          updated_at: string
          widget_type: string
          width: number | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          dashboard_id: string
          data_source?: string | null
          filters?: Json | null
          height?: number | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          title: string
          updated_at?: string
          widget_type: string
          width?: number | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          dashboard_id?: string
          data_source?: string | null
          filters?: Json | null
          height?: number | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          title?: string
          updated_at?: string
          widget_type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboard_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_name: string | null
          construction_site_id: string | null
          created_at: string | null
          created_by_user_id: string
          department: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          project_id: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          construction_site_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          department?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          project_id?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          construction_site_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          department?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          project_id?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_produtividade: {
        Row: {
          created_at: string
          data: string
          id: string
          observacoes: string | null
          quantidade: number
          receita: number | null
          tipo_entrega: string
          unidade_id: string | null
          unidade_medida: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          observacoes?: string | null
          quantidade: number
          receita?: number | null
          tipo_entrega: string
          unidade_id?: string | null
          unidade_medida: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          quantidade?: number
          receita?: number | null
          tipo_entrega?: string
          unidade_id?: string | null
          unidade_medida?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_produtividade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_clt: {
        Row: {
          alertas_clt: Json | null
          created_at: string
          custo_total: number
          data: string
          funcao: string | null
          funcionario_id: string
          hora_entrada: string
          hora_fim_intervalo: string | null
          hora_inicio_intervalo: string | null
          hora_saida: string
          horas_extras: number
          horas_normais: number
          horas_noturnas: number
          id: string
          is_domingo: boolean
          is_feriado: boolean
          is_folga: boolean
          observacoes: string | null
          status_clt: string
          tipo_escala: string
          turno_id: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string
          valor_adicional_noturno: number
          valor_hora_extra: number
          valor_hora_normal: number
        }
        Insert: {
          alertas_clt?: Json | null
          created_at?: string
          custo_total?: number
          data: string
          funcao?: string | null
          funcionario_id: string
          hora_entrada: string
          hora_fim_intervalo?: string | null
          hora_inicio_intervalo?: string | null
          hora_saida: string
          horas_extras?: number
          horas_normais?: number
          horas_noturnas?: number
          id?: string
          is_domingo?: boolean
          is_feriado?: boolean
          is_folga?: boolean
          observacoes?: string | null
          status_clt?: string
          tipo_escala: string
          turno_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id: string
          valor_adicional_noturno?: number
          valor_hora_extra?: number
          valor_hora_normal?: number
        }
        Update: {
          alertas_clt?: Json | null
          created_at?: string
          custo_total?: number
          data?: string
          funcao?: string | null
          funcionario_id?: string
          hora_entrada?: string
          hora_fim_intervalo?: string | null
          hora_inicio_intervalo?: string | null
          hora_saida?: string
          horas_extras?: number
          horas_normais?: number
          horas_noturnas?: number
          id?: string
          is_domingo?: boolean
          is_feriado?: boolean
          is_folga?: boolean
          observacoes?: string | null
          status_clt?: string
          tipo_escala?: string
          turno_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
          valor_adicional_noturno?: number
          valor_hora_extra?: number
          valor_hora_normal?: number
        }
        Relationships: [
          {
            foreignKeyName: "escalas_clt_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_clt_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_clt_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      executed_services: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          daily_report_id: string
          employee_id: string | null
          equipment_used: Json | null
          id: string
          quantity: number
          service_id: string
          unit: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          daily_report_id: string
          employee_id?: string | null
          equipment_used?: Json | null
          id?: string
          quantity: number
          service_id: string
          unit: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          daily_report_id?: string
          employee_id?: string | null
          equipment_used?: Json | null
          id?: string
          quantity?: number
          service_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "executed_services_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_services_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      faltas_funcionarios: {
        Row: {
          arquivo_url: string | null
          created_at: string
          data: string
          escala_id: string | null
          funcionario_id: string
          horas_perdidas: number | null
          id: string
          impacto_custo: number | null
          observacoes: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          data: string
          escala_id?: string | null
          funcionario_id: string
          horas_perdidas?: number | null
          id?: string
          impacto_custo?: number | null
          observacoes?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          data?: string
          escala_id?: string | null
          funcionario_id?: string
          horas_perdidas?: number | null
          id?: string
          impacto_custo?: number | null
          observacoes?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faltas_funcionarios_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_clt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          created_at: string
          data: string
          id: string
          nome: string
          recorrente: boolean
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          nome: string
          recorrente?: boolean
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          nome?: string
          recorrente?: boolean
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      formulario_modelos: {
        Row: {
          campos: Json
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo_obra: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          campos: Json
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo_obra?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          campos?: Json
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo_obra?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      formularios_producao: {
        Row: {
          created_at: string | null
          data_registro: string
          equipe_nome: string | null
          fotos_urls: string[] | null
          frente_servico: string
          id: string
          localizacao_gps: string | null
          modelo_id: string | null
          obra_id: string
          observacoes: string | null
          responsavel_nome: string | null
          respostas: Json
          updated_at: string | null
          videos_urls: string[] | null
        }
        Insert: {
          created_at?: string | null
          data_registro?: string
          equipe_nome?: string | null
          fotos_urls?: string[] | null
          frente_servico: string
          id?: string
          localizacao_gps?: string | null
          modelo_id?: string | null
          obra_id: string
          observacoes?: string | null
          responsavel_nome?: string | null
          respostas: Json
          updated_at?: string | null
          videos_urls?: string[] | null
        }
        Update: {
          created_at?: string | null
          data_registro?: string
          equipe_nome?: string | null
          fotos_urls?: string[] | null
          frente_servico?: string
          id?: string
          localizacao_gps?: string | null
          modelo_id?: string | null
          obra_id?: string
          observacoes?: string | null
          responsavel_nome?: string | null
          respostas?: Json
          updated_at?: string | null
          videos_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "formularios_producao_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "formulario_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_producao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          departamento: string | null
          email: string | null
          id: string
          nome: string
          salario_base: number | null
          telefone: string | null
          tipo_contrato: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          departamento?: string | null
          email?: string | null
          id?: string
          nome: string
          salario_base?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          departamento?: string | null
          email?: string | null
          id?: string
          nome?: string
          salario_base?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          location: string | null
          material_code: string | null
          material_name: string
          minimum_stock: number | null
          notes: string | null
          project_id: string | null
          quantity_available: number
          supplier: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          location?: string | null
          material_code?: string | null
          material_name: string
          minimum_stock?: number | null
          notes?: string | null
          project_id?: string | null
          quantity_available?: number
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          location?: string | null
          material_code?: string | null
          material_name?: string
          minimum_stock?: number | null
          notes?: string | null
          project_id?: string | null
          quantity_available?: number
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          inventory_id: string
          movement_type: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          inventory_id: string
          movement_type: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          inventory_id?: string
          movement_type?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      justifications: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          daily_report_id: string
          executed_service_id: string | null
          id: string
          reason: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          daily_report_id: string
          executed_service_id?: string | null
          id?: string
          reason: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          daily_report_id?: string
          executed_service_id?: string | null
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "justifications_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justifications_executed_service_id_fkey"
            columns: ["executed_service_id"]
            isOneToOne: false
            referencedRelation: "executed_services"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_tracking: {
        Row: {
          activity_description: string | null
          category: string
          company_name: string | null
          created_at: string | null
          created_by_user_id: string
          employee_id: string | null
          entry_time: string
          exit_time: string | null
          hourly_rate: number | null
          hours_worked: number | null
          id: string
          project_id: string
          total_cost: number | null
          updated_at: string | null
          work_date: string
          worker_name: string
        }
        Insert: {
          activity_description?: string | null
          category: string
          company_name?: string | null
          created_at?: string | null
          created_by_user_id: string
          employee_id?: string | null
          entry_time: string
          exit_time?: string | null
          hourly_rate?: number | null
          hours_worked?: number | null
          id?: string
          project_id: string
          total_cost?: number | null
          updated_at?: string | null
          work_date?: string
          worker_name: string
        }
        Update: {
          activity_description?: string | null
          category?: string
          company_name?: string | null
          created_at?: string | null
          created_by_user_id?: string
          employee_id?: string | null
          entry_time?: string
          exit_time?: string | null
          hourly_rate?: number | null
          hours_worked?: number | null
          id?: string
          project_id?: string
          total_cost?: number | null
          updated_at?: string | null
          work_date?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_tracking_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_qr_codes: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          is_active: boolean | null
          location_description: string | null
          location_name: string
          project_id: string
          qr_code_data: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          is_active?: boolean | null
          location_description?: string | null
          location_name: string
          project_id: string
          qr_code_data: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          is_active?: boolean | null
          location_description?: string | null
          location_name?: string
          project_id?: string
          qr_code_data?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_qr_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_request_rate_limits: {
        Row: {
          client_ip: string
          created_at: string
          id: string
          qr_code_id: string
        }
        Insert: {
          client_ip: string
          created_at?: string
          id?: string
          qr_code_id: string
        }
        Update: {
          client_ip?: string
          created_at?: string
          id?: string
          qr_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_request_rate_limits_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "maintenance_qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          created_at: string | null
          id: string
          issue_description: string
          photos_urls: string[] | null
          qr_code_id: string
          requester_contact: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          updated_at: string | null
          urgency_level: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_description: string
          photos_urls?: string[] | null
          qr_code_id: string
          requester_contact?: string | null
          requester_name: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          updated_at?: string | null
          urgency_level?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_description?: string
          photos_urls?: string[] | null
          qr_code_id?: string
          requester_contact?: string | null
          requester_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          updated_at?: string | null
          urgency_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "maintenance_qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          asset_id: string | null
          assigned_to_employee_id: string | null
          assigned_to_user_id: string | null
          classification: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          created_by_user_id: string
          deadline: string | null
          description: string | null
          id: string
          materials_used: Json | null
          pending_reason: string | null
          priority: string | null
          project_id: string | null
          responsible_type: string | null
          service_subtype: string | null
          service_type: string | null
          status: string
          task_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_user_id?: string | null
          classification?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          created_by_user_id: string
          deadline?: string | null
          description?: string | null
          id?: string
          materials_used?: Json | null
          pending_reason?: string | null
          priority?: string | null
          project_id?: string | null
          responsible_type?: string | null
          service_subtype?: string | null
          service_type?: string | null
          status?: string
          task_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_user_id?: string | null
          classification?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          created_by_user_id?: string
          deadline?: string | null
          description?: string | null
          id?: string
          materials_used?: Json | null
          pending_reason?: string | null
          priority?: string | null
          project_id?: string | null
          responsible_type?: string | null
          service_subtype?: string | null
          service_type?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      map_annotations: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          descricao: string | null
          id: string
          latitude: number
          longitude: number
          porcentagem: number | null
          project_id: string
          service_front_id: string | null
          team_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          descricao?: string | null
          id?: string
          latitude: number
          longitude: number
          porcentagem?: number | null
          project_id: string
          service_front_id?: string | null
          team_id?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          descricao?: string | null
          id?: string
          latitude?: number
          longitude?: number
          porcentagem?: number | null
          project_id?: string
          service_front_id?: string | null
          team_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_annotations_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_annotations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      material_control: {
        Row: {
          created_at: string | null
          id: string
          material_name: string
          project_id: string
          quantity_used: number
          recorded_by_user_id: string
          service_front_id: string
          unit: string
          updated_at: string | null
          usage_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_name: string
          project_id: string
          quantity_used: number
          recorded_by_user_id: string
          service_front_id: string
          unit: string
          updated_at?: string | null
          usage_date?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          material_name?: string
          project_id?: string
          quantity_used?: number
          recorded_by_user_id?: string
          service_front_id?: string
          unit?: string
          updated_at?: string | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_control_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_control_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string | null
          id: string
          material_name: string
          needed_date: string | null
          project_id: string
          quantity: number
          request_date: string
          requested_by_employee_id: string | null
          requested_by_user_id: string
          requestor_name: string | null
          service_front_id: string
          status: string
          unit: string
          updated_at: string | null
          usage_location: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_name: string
          needed_date?: string | null
          project_id: string
          quantity: number
          request_date?: string
          requested_by_employee_id?: string | null
          requested_by_user_id: string
          requestor_name?: string | null
          service_front_id: string
          status?: string
          unit: string
          updated_at?: string | null
          usage_location?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_name?: string
          needed_date?: string | null
          project_id?: string
          quantity?: number
          request_date?: string
          requested_by_employee_id?: string | null
          requested_by_user_id?: string
          requestor_name?: string | null
          service_front_id?: string
          status?: string
          unit?: string
          updated_at?: string | null
          usage_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          created_at: string | null
          created_by_user_id: string
          current_price: number
          current_stock: number | null
          description: string | null
          description_norm: string | null
          id: string
          keywords: string[] | null
          keywords_norm: string[] | null
          labor_price: number | null
          material_price: number | null
          measurement: string | null
          minimum_stock: number | null
          name: string
          notes: string | null
          supplier: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by_user_id: string
          current_price?: number
          current_stock?: number | null
          description?: string | null
          description_norm?: string | null
          id?: string
          keywords?: string[] | null
          keywords_norm?: string[] | null
          labor_price?: number | null
          material_price?: number | null
          measurement?: string | null
          minimum_stock?: number | null
          name: string
          notes?: string | null
          supplier?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by_user_id?: string
          current_price?: number
          current_stock?: number | null
          description?: string | null
          description_norm?: string | null
          id?: string
          keywords?: string[] | null
          keywords_norm?: string[] | null
          labor_price?: number | null
          material_price?: number | null
          measurement?: string | null
          minimum_stock?: number | null
          name?: string
          notes?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      metas_prime_cost: {
        Row: {
          created_at: string
          id: string
          meta_cmo_percent: number
          meta_cmv_percent: number
          meta_prime_cost_percent: number
          meta_produtividade: number | null
          modo_produtividade: string
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_cmo_percent?: number
          meta_cmv_percent?: number
          meta_prime_cost_percent?: number
          meta_produtividade?: number | null
          modo_produtividade?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_cmo_percent?: number
          meta_cmv_percent?: number
          meta_prime_cost_percent?: number
          meta_produtividade?: number | null
          modo_produtividade?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_prime_cost_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_producao: {
        Row: {
          created_at: string | null
          frente_servico: string
          id: string
          meta_diaria: number | null
          obra_id: string
          periodo_fim: string | null
          periodo_inicio: string
          unidade: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frente_servico: string
          id?: string
          meta_diaria?: number | null
          obra_id: string
          periodo_fim?: string | null
          periodo_inicio: string
          unidade: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frente_servico?: string
          id?: string
          meta_diaria?: number | null
          obra_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string
          unidade?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_producao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          created_at: string | null
          data_inicio: string
          data_prevista_fim: string | null
          id: string
          latitude: number | null
          localizacao: string
          longitude: number | null
          nome: string
          status: string | null
          tipo_obra: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_inicio: string
          data_prevista_fim?: string | null
          id?: string
          latitude?: number | null
          localizacao: string
          longitude?: number | null
          nome: string
          status?: string | null
          tipo_obra: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_inicio?: string
          data_prevista_fim?: string | null
          id?: string
          latitude?: number | null
          localizacao?: string
          longitude?: number | null
          nome?: string
          status?: string | null
          tipo_obra?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          correction_deadline: string | null
          created_at: string | null
          created_by_user_id: string
          daily_report_id: string | null
          description: string
          id: string
          occurrence_type: string
          photos_urls: string[] | null
          project_id: string
          resolution_notes: string | null
          resolved_at: string | null
          responsible_id: string | null
          responsible_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          correction_deadline?: string | null
          created_at?: string | null
          created_by_user_id: string
          daily_report_id?: string | null
          description: string
          id?: string
          occurrence_type: string
          photos_urls?: string[] | null
          project_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          responsible_id?: string | null
          responsible_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          correction_deadline?: string | null
          created_at?: string | null
          created_by_user_id?: string
          daily_report_id?: string | null
          description?: string
          id?: string
          occurrence_type?: string
          photos_urls?: string[] | null
          project_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          responsible_id?: string | null
          responsible_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_actions: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          reason: string | null
          requested_by_user_id: string
          resource_data: Json | null
          resource_id: string
          resource_type: string
          status: string
          updated_at: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          reason?: string | null
          requested_by_user_id: string
          resource_data?: Json | null
          resource_id: string
          resource_type: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          requested_by_user_id?: string
          resource_data?: Json | null
          resource_id?: string
          resource_type?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      postos_cobertura: {
        Row: {
          ativo: boolean
          cargo: string
          created_at: string
          dias_semana: number[]
          frente_obra: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          prioridade: string
          quantidade_minima: number
          turno_periodo: string
          unidade_id: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cargo: string
          created_at?: string
          dias_semana?: number[]
          frente_obra?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          prioridade?: string
          quantidade_minima?: number
          turno_periodo?: string
          unidade_id?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          cargo?: string
          created_at?: string
          dias_semana?: number[]
          frente_obra?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          prioridade?: string
          quantidade_minima?: number
          turno_periodo?: string
          unidade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "postos_cobertura_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_at: string | null
          changed_by_user_id: string
          id: string
          material_id: string
          new_price: number
          notes: string | null
          old_price: number
        }
        Insert: {
          changed_at?: string | null
          changed_by_user_id: string
          id?: string
          material_id: string
          new_price: number
          notes?: string | null
          old_price: number
        }
        Update: {
          changed_at?: string | null
          changed_by_user_id?: string
          id?: string
          material_id?: string
          new_price?: number
          notes?: string | null
          old_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      production_targets: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          employee_id: string | null
          id: string
          service_front_id: string
          service_id: string
          target_date: string
          target_quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          employee_id?: string | null
          id?: string
          service_front_id: string
          service_id: string
          target_date: string
          target_quantity: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          employee_id?: string | null
          id?: string
          service_front_id?: string
          service_id?: string
          target_date?: string
          target_quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_targets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_targets_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_targets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string | null
          created_by_user_id: string
          end_date: string | null
          id: string
          interactive_map_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          start_date: string
          status: string | null
          team_members: string | null
          total_budget: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          end_date?: string | null
          id?: string
          interactive_map_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          start_date: string
          status?: string | null
          team_members?: string | null
          total_budget?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          end_date?: string | null
          id?: string
          interactive_map_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          start_date?: string
          status?: string | null
          team_members?: string | null
          total_budget?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          created_at: string | null
          created_by_user_id: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          project_id: string
          purchase_request_id: string
          status: string
          supplier_name: string
          supplier_quote_id: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string | null
          created_by_user_id: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          project_id: string
          purchase_request_id: string
          status?: string
          supplier_name: string
          supplier_quote_id?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string | null
          created_by_user_id?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          project_id?: string
          purchase_request_id?: string
          status?: string
          supplier_name?: string
          supplier_quote_id?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_quote_id_fkey"
            columns: ["supplier_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          cost_center: string | null
          created_at: string | null
          estimated_cost: number | null
          hide_cost_from_members: boolean | null
          id: string
          item_name: string
          justification: string | null
          project_id: string
          quantity: number
          rejection_reason: string | null
          requested_by_user_id: string
          status: string
          unit: string
          updated_at: string | null
          urgency: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          cost_center?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          hide_cost_from_members?: boolean | null
          id?: string
          item_name: string
          justification?: string | null
          project_id: string
          quantity: number
          rejection_reason?: string | null
          requested_by_user_id: string
          status?: string
          unit: string
          updated_at?: string | null
          urgency: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          cost_center?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          hide_cost_from_members?: boolean | null
          id?: string
          item_name?: string
          justification?: string | null
          project_id?: string
          quantity?: number
          rejection_reason?: string | null
          requested_by_user_id?: string
          status?: string
          unit?: string
          updated_at?: string | null
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_validation_photos: {
        Row: {
          created_by_user_id: string
          daily_report_id: string
          id: string
          photo_url: string
          uploaded_at: string | null
        }
        Insert: {
          created_by_user_id: string
          daily_report_id: string
          id?: string
          photo_url: string
          uploaded_at?: string | null
        }
        Update: {
          created_by_user_id?: string
          daily_report_id?: string
          id?: string
          photo_url?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_validation_photos_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          clima_previsao_chuva: boolean | null
          clima_temperatura: number | null
          clima_umidade: number | null
          clima_vento_velocidade: number | null
          condicao_terreno: string | null
          created_at: string | null
          data: string
          fotos_validacao: string[] | null
          id: string
          localizacao_validada: string | null
          obra_id: string
          observacoes_gerais: string | null
          producao_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          clima_previsao_chuva?: boolean | null
          clima_temperatura?: number | null
          clima_umidade?: number | null
          clima_vento_velocidade?: number | null
          condicao_terreno?: string | null
          created_at?: string | null
          data?: string
          fotos_validacao?: string[] | null
          id?: string
          localizacao_validada?: string | null
          obra_id: string
          observacoes_gerais?: string | null
          producao_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          clima_previsao_chuva?: boolean | null
          clima_temperatura?: number | null
          clima_umidade?: number | null
          clima_vento_velocidade?: number | null
          condicao_terreno?: string | null
          created_at?: string | null
          data?: string
          fotos_validacao?: string[] | null
          id?: string
          localizacao_validada?: string | null
          obra_id?: string
          observacoes_gerais?: string | null
          producao_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          created_at: string
          data_trust_level: string
          desired_features: string[] | null
          dismissed_at: string | null
          dispatch_id: string | null
          ease_of_start: string
          general_satisfaction: string
          generated_results: string
          help_areas: string[] | null
          hours_saved_per_week: number | null
          id: string
          indispensable_feature: string | null
          initial_difficulty: string
          initial_difficulty_other: string | null
          monthly_savings: number | null
          most_used_features: string[] | null
          next_available_at: string | null
          nps_justification: string | null
          nps_score: number
          one_improvement: string | null
          one_sentence_summary: string | null
          operation_type: string
          operation_type_other: string | null
          preferred_support_format: string
          referral_target: string | null
          solution_expectation: string | null
          stop_reason: string | null
          support_resolution: string
          trust_issues: string[] | null
          trust_issues_other: string | null
          urgent_improvement: string
          urgent_improvement_other: string | null
          user_id: string | null
          user_profile: string
          user_profile_other: string | null
          users_count: string
          would_recommend: string
          would_stop_using: string
        }
        Insert: {
          created_at?: string
          data_trust_level: string
          desired_features?: string[] | null
          dismissed_at?: string | null
          dispatch_id?: string | null
          ease_of_start: string
          general_satisfaction: string
          generated_results: string
          help_areas?: string[] | null
          hours_saved_per_week?: number | null
          id?: string
          indispensable_feature?: string | null
          initial_difficulty: string
          initial_difficulty_other?: string | null
          monthly_savings?: number | null
          most_used_features?: string[] | null
          next_available_at?: string | null
          nps_justification?: string | null
          nps_score: number
          one_improvement?: string | null
          one_sentence_summary?: string | null
          operation_type: string
          operation_type_other?: string | null
          preferred_support_format: string
          referral_target?: string | null
          solution_expectation?: string | null
          stop_reason?: string | null
          support_resolution: string
          trust_issues?: string[] | null
          trust_issues_other?: string | null
          urgent_improvement: string
          urgent_improvement_other?: string | null
          user_id?: string | null
          user_profile: string
          user_profile_other?: string | null
          users_count: string
          would_recommend: string
          would_stop_using: string
        }
        Update: {
          created_at?: string
          data_trust_level?: string
          desired_features?: string[] | null
          dismissed_at?: string | null
          dispatch_id?: string | null
          ease_of_start?: string
          general_satisfaction?: string
          generated_results?: string
          help_areas?: string[] | null
          hours_saved_per_week?: number | null
          id?: string
          indispensable_feature?: string | null
          initial_difficulty?: string
          initial_difficulty_other?: string | null
          monthly_savings?: number | null
          most_used_features?: string[] | null
          next_available_at?: string | null
          nps_justification?: string | null
          nps_score?: number
          one_improvement?: string | null
          one_sentence_summary?: string | null
          operation_type?: string
          operation_type_other?: string | null
          preferred_support_format?: string
          referral_target?: string | null
          solution_expectation?: string | null
          stop_reason?: string | null
          support_resolution?: string
          trust_issues?: string[] | null
          trust_issues_other?: string | null
          urgent_improvement?: string
          urgent_improvement_other?: string | null
          user_id?: string | null
          user_profile?: string
          user_profile_other?: string | null
          users_count?: string
          would_recommend?: string
          would_stop_using?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "survey_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_fronts: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_fronts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      services_catalog: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          name: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          name: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          name?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      substituicoes: {
        Row: {
          created_at: string
          data: string
          escala_id: string | null
          executado_por: string | null
          falta_id: string | null
          funcionario_ausente_id: string
          funcionario_substituto_id: string
          id: string
          impacto_custo: number | null
          motivo: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          escala_id?: string | null
          executado_por?: string | null
          falta_id?: string | null
          funcionario_ausente_id: string
          funcionario_substituto_id: string
          id?: string
          impacto_custo?: number | null
          motivo?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          escala_id?: string | null
          executado_por?: string | null
          falta_id?: string | null
          funcionario_ausente_id?: string
          funcionario_substituto_id?: string
          id?: string
          impacto_custo?: number | null
          motivo?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substituicoes_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_clt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_falta_id_fkey"
            columns: ["falta_id"]
            isOneToOne: false
            referencedRelation: "faltas_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_funcionario_ausente_id_fkey"
            columns: ["funcionario_ausente_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_funcionario_substituto_id_fkey"
            columns: ["funcionario_substituto_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          delivery_time_days: number | null
          id: string
          notes: string | null
          payment_terms: string | null
          project_id: string | null
          purchase_request_id: string
          supplier_contact: string | null
          supplier_name: string
          total_price: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          delivery_time_days?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          project_id?: string | null
          purchase_request_id: string
          supplier_contact?: string | null
          supplier_name: string
          total_price: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          delivery_time_days?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          project_id?: string | null
          purchase_request_id?: string
          supplier_contact?: string | null
          supplier_name?: string
          total_price?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_dispatches: {
        Row: {
          created_at: string
          dismissed_at: string | null
          dispatched_at: string
          dispatched_by: string
          expires_at: string | null
          id: string
          is_dismissed: boolean
          responded_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          dispatched_at?: string
          dispatched_by: string
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean
          responded_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          dispatched_at?: string
          dispatched_by?: string
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean
          responded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string | null
          description: string
          id: string
          is_completed: boolean | null
          notes: string | null
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          task_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_photos: {
        Row: {
          description: string | null
          id: string
          photo_url: string
          task_id: string
          uploaded_at: string | null
          uploaded_by_user_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          photo_url: string
          task_id: string
          uploaded_at?: string | null
          uploaded_by_user_id: string
        }
        Update: {
          description?: string | null
          id?: string
          photo_url?: string
          task_id?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          ativo: boolean
          created_at: string
          hora_fim: string
          hora_inicio: string
          id: string
          intervalo_minutos: number | null
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          hora_fim: string
          hora_inicio: string
          id?: string
          intervalo_minutos?: number | null
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          intervalo_minutos?: number | null
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          emoji_rating: string | null
          feedback_type: string
          id: string
          module_context: string | null
          page_context: string | null
          question: string | null
          rating: number | null
          screenshot_url: string | null
          text_response: string | null
          trigger_event: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji_rating?: string | null
          feedback_type?: string
          id?: string
          module_context?: string | null
          page_context?: string | null
          question?: string | null
          rating?: number | null
          screenshot_url?: string | null
          text_response?: string | null
          trigger_event?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emoji_rating?: string | null
          feedback_type?: string
          id?: string
          module_context?: string | null
          page_context?: string | null
          question?: string | null
          rating?: number | null
          screenshot_url?: string | null
          text_response?: string | null
          trigger_event?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          company_name: string | null
          company_size: string | null
          created_at: string
          id: string
          main_challenge: string | null
          onboarding_completed: boolean | null
          phone: string | null
          role: string | null
          segment: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          main_challenge?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          role?: string | null
          segment?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          main_challenge?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          role?: string | null
          segment?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          created_at: string | null
          id: string
          max_employees: number | null
          max_projects: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_employees?: number | null
          max_projects?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_employees?: number | null
          max_projects?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_super_admin: boolean | null
          project_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_super_admin?: boolean | null
          project_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_super_admin?: boolean | null
          project_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_survey_tracker: {
        Row: {
          id: string
          last_shown_at: string
          show_count: number
          survey_type: string
          user_id: string
        }
        Insert: {
          id?: string
          last_shown_at?: string
          show_count?: number
          survey_type: string
          user_id: string
        }
        Update: {
          id?: string
          last_shown_at?: string
          show_count?: number
          survey_type?: string
          user_id?: string
        }
        Relationships: []
      }
      validacoes_clt: {
        Row: {
          created_at: string
          detalhes: Json | null
          escala_id: string | null
          funcionario_id: string | null
          id: string
          mensagem: string
          nivel: string
          resolvido: boolean
          tipo_validacao: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          escala_id?: string | null
          funcionario_id?: string | null
          id?: string
          mensagem: string
          nivel: string
          resolvido?: boolean
          tipo_validacao: string
          user_id: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          escala_id?: string | null
          funcionario_id?: string | null
          id?: string
          mensagem?: string
          nivel?: string
          resolvido?: boolean
          tipo_validacao?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validacoes_clt_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_clt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validacoes_clt_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      hydro_saved_plans: {
        Row: {
          id: string
          user_id: string | null
          nome: string
          descricao: string | null
          num_equipes: number
          team_config: Json
          metros_dia: number
          horas_trabalho: number
          work_days: number
          data_inicio: string | null
          data_termino: string | null
          productivity: Json
          holidays: Json
          trecho_overrides: Json
          service_notes: Json
          trecho_metadata: Json
          grouping_mode: string
          schedule_snapshot: Json | null
          total_metros: number | null
          total_dias: number | null
          custo_total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          nome: string
          descricao?: string | null
          num_equipes?: number
          team_config?: Json
          metros_dia?: number
          horas_trabalho?: number
          work_days?: number
          data_inicio?: string | null
          data_termino?: string | null
          productivity?: Json
          holidays?: Json
          trecho_overrides?: Json
          service_notes?: Json
          trecho_metadata?: Json
          grouping_mode?: string
          schedule_snapshot?: Json | null
          total_metros?: number | null
          total_dias?: number | null
          custo_total?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          nome?: string
          descricao?: string | null
          num_equipes?: number
          team_config?: Json
          metros_dia?: number
          horas_trabalho?: number
          work_days?: number
          data_inicio?: string | null
          data_termino?: string | null
          productivity?: Json
          holidays?: Json
          trecho_overrides?: Json
          service_notes?: Json
          trecho_metadata?: Json
          grouping_mode?: string
          schedule_snapshot?: Json | null
          total_metros?: number | null
          total_dias?: number | null
          custo_total?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hydro_rdos: {
        Row: {
          id: string
          user_id: string | null
          project_id: string
          date: string
          project_name: string
          obra_name: string | null
          status: string
          services: Json
          segments: Json
          notes: string | null
          occurrences: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          project_id?: string
          date?: string
          project_name?: string
          obra_name?: string | null
          status?: string
          services?: Json
          segments?: Json
          notes?: string | null
          occurrences?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          project_id?: string
          date?: string
          project_name?: string
          obra_name?: string | null
          status?: string
          services?: Json
          segments?: Json
          notes?: string | null
          occurrences?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hydro_equipments: {
        Row: {
          id: string
          user_id: string | null
          nome: string
          tipo: string
          placa: string | null
          proprietario: string | null
          custo_hora: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          nome: string
          tipo?: string
          placa?: string | null
          proprietario?: string | null
          custo_hora?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          nome?: string
          tipo?: string
          placa?: string | null
          proprietario?: string | null
          custo_hora?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hydro_dimensioning_projects: {
        Row: {
          id: string
          user_id: string | null
          nome: string
          project_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          nome: string
          project_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          nome?: string
          project_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hub_coleta_meta: {
        Row: {
          id: string
          tipo: string
          ultima_coleta: string
          total_coletado: number
          total_novos: number
          fonte: string | null
          status: string
          erro: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tipo: string
          ultima_coleta?: string
          total_coletado?: number
          total_novos?: number
          fonte?: string | null
          status?: string
          erro?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tipo?: string
          ultima_coleta?: string
          total_coletado?: number
          total_novos?: number
          fonte?: string | null
          status?: string
          erro?: string | null
          created_at?: string
        }
        Relationships: []
      }
      hub_licitacoes: {
        Row: {
          id: string
          numero_controle: string
          titulo: string
          orgao: string
          estado: string
          categoria: string
          data_abertura: string | null
          valor_estimado: number
          valor_estimado_fmt: string | null
          link: string
          modalidade: string | null
          modalidade_id: number | null
          cnpj_orgao: string | null
          ano_compra: number | null
          sequencial_compra: number | null
          fonte: string
          verificado: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero_controle: string
          titulo: string
          orgao: string
          estado?: string
          categoria?: string
          data_abertura?: string | null
          valor_estimado?: number
          valor_estimado_fmt?: string | null
          link: string
          modalidade?: string | null
          modalidade_id?: number | null
          cnpj_orgao?: string | null
          ano_compra?: number | null
          sequencial_compra?: number | null
          fonte?: string
          verificado?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          numero_controle?: string
          titulo?: string
          orgao?: string
          estado?: string
          categoria?: string
          data_abertura?: string | null
          valor_estimado?: number
          valor_estimado_fmt?: string | null
          link?: string
          modalidade?: string | null
          modalidade_id?: number | null
          cnpj_orgao?: string | null
          ano_compra?: number | null
          sequencial_compra?: number | null
          fonte?: string
          verificado?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hydro_bdi_contracts: {
        Row: {
          id: string
          user_id: string | null
          nome: string
          contratante: string | null
          tipo_contrato: string | null
          numero_edital: string | null
          status: string | null
          municipio: string | null
          estado: string | null
          data_inicio: string | null
          data_termino: string | null
          duracao_meses: number | null
          custo_direto_total: number | null
          bdi_percentual: number | null
          preco_venda: number | null
          valor_edital: number | null
          contract_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          nome: string
          contratante?: string | null
          tipo_contrato?: string | null
          numero_edital?: string | null
          status?: string | null
          municipio?: string | null
          estado?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          duracao_meses?: number | null
          custo_direto_total?: number | null
          bdi_percentual?: number | null
          preco_venda?: number | null
          valor_edital?: number | null
          contract_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          nome?: string
          contratante?: string | null
          tipo_contrato?: string | null
          numero_edital?: string | null
          status?: string | null
          municipio?: string | null
          estado?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          duracao_meses?: number | null
          bdi_percentual?: number | null
          preco_venda?: number | null
          valor_edital?: number | null
          contract_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_approval_control: {
        Row: {
          id: string
          user_id: string | null
          project_id: string | null
          nome_projeto: string
          etapa: string
          sub_etapa: string | null
          emissor: string
          destinatario: string | null
          data_envio: string
          prazo: string | null
          status: string | null
          observacoes: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          project_id?: string | null
          nome_projeto: string
          etapa: string
          sub_etapa?: string | null
          emissor: string
          destinatario?: string | null
          data_envio?: string
          prazo?: string | null
          status?: string | null
          observacoes?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          project_id?: string | null
          nome_projeto?: string
          etapa?: string
          sub_etapa?: string | null
          emissor?: string
          destinatario?: string | null
          data_envio?: string
          prazo?: string | null
          status?: string | null
          observacoes?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_employee: { Args: { user_uuid: string }; Returns: boolean }
      can_create_project: { Args: { user_uuid: string }; Returns: boolean }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      get_supplier_quote_project_id: {
        Args: { _quote_id: string }
        Returns: string
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_qrcode_access: {
        Args: { _qr_code_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _project_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_project_manager: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_text_for_matching: {
        Args: { input_text: string }
        Returns: string
      }
      tokenize_keywords: { Args: { input_text: string }; Returns: string[] }
      validate_cnpj_format: { Args: { cnpj: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "manager"
      crm_activity_status: "pending" | "completed" | "cancelled"
      crm_activity_type: "task" | "call" | "meeting" | "followup" | "note"
      crm_contact_status: "active" | "inactive" | "archived"
      crm_deal_status: "open" | "won" | "lost"
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
      app_role: ["admin", "user", "manager"],
      crm_activity_status: ["pending", "completed", "cancelled"],
      crm_activity_type: ["task", "call", "meeting", "followup", "note"],
      crm_contact_status: ["active", "inactive", "archived"],
      crm_deal_status: ["open", "won", "lost"],
    },
  },
} as const
