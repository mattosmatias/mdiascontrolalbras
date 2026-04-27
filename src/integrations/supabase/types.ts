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
      daily_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          notes: string | null
          s1_mov_lingoteiras: number
          s10_mov_nao_conforme: number
          s2_embalagem_pet: number
          s3_mov_toplifting: number
          s4_cintagem_metalica: number
          s5_mov_estocagem: number
          s6_transp_carreta_adm: number
          s7_transp_carreta_fora: number
          s8_transp_porto: number
          s9_mov_toplifting_estoq: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date: string
          id?: string
          notes?: string | null
          s1_mov_lingoteiras?: number
          s10_mov_nao_conforme?: number
          s2_embalagem_pet?: number
          s3_mov_toplifting?: number
          s4_cintagem_metalica?: number
          s5_mov_estocagem?: number
          s6_transp_carreta_adm?: number
          s7_transp_carreta_fora?: number
          s8_transp_porto?: number
          s9_mov_toplifting_estoq?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          s1_mov_lingoteiras?: number
          s10_mov_nao_conforme?: number
          s2_embalagem_pet?: number
          s3_mov_toplifting?: number
          s4_cintagem_metalica?: number
          s5_mov_estocagem?: number
          s6_transp_carreta_adm?: number
          s7_transp_carreta_fora?: number
          s8_transp_porto?: number
          s9_mov_toplifting_estoq?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_hours: {
        Row: {
          created_at: string
          created_by: string | null
          enc_adn: number
          enc_he100: number
          enc_he65: number
          entry_date: string
          id: string
          notes: string | null
          ope_24h: number
          ope_adm: number
          ope_adn: number
          ope_he100: number
          ope_he65: number
          sup_24h: number
          sup_adm: number
          sup_adn: number
          sup_he100: number
          sup_he65: number
          tst_adn: number
          tst_he100: number
          tst_he65: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enc_adn?: number
          enc_he100?: number
          enc_he65?: number
          entry_date: string
          id?: string
          notes?: string | null
          ope_24h?: number
          ope_adm?: number
          ope_adn?: number
          ope_he100?: number
          ope_he65?: number
          sup_24h?: number
          sup_adm?: number
          sup_adn?: number
          sup_he100?: number
          sup_he65?: number
          tst_adn?: number
          tst_he100?: number
          tst_he65?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enc_adn?: number
          enc_he100?: number
          enc_he65?: number
          entry_date?: string
          id?: string
          notes?: string | null
          ope_24h?: number
          ope_adm?: number
          ope_adn?: number
          ope_he100?: number
          ope_he65?: number
          sup_24h?: number
          sup_adm?: number
          sup_adn?: number
          sup_he100?: number
          sup_he65?: number
          tst_adn?: number
          tst_he100?: number
          tst_he65?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_prices: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          group_label: string
          id: string
          line_no: number
          ref: string | null
          source_key: string
          source_kind: string
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          display_order?: number
          group_label: string
          id?: string
          line_no: number
          ref?: string | null
          source_key: string
          source_kind: string
          unit: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          group_label?: string
          id?: string
          line_no?: number
          ref?: string | null
          source_key?: string
          source_kind?: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador" | "diretoria"
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
      app_role: ["admin", "operador", "diretoria"],
    },
  },
} as const
