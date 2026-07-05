import type { RoomStatus } from "./game";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          code: string;
          name: string;
          is_visible: boolean;
          password_hash: string | null;
          status: RoomStatus;
          day_number: number;
          discussion_seconds: number;
          discussion_started_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name?: string;
          is_visible?: boolean;
          password_hash?: string | null;
          status?: RoomStatus;
          day_number?: number;
          discussion_seconds?: number;
          discussion_started_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          is_visible?: boolean;
          password_hash?: string | null;
          status?: RoomStatus;
          day_number?: number;
          discussion_seconds?: number;
          discussion_started_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          name: string;
          role: string | null;
          team: string | null;
          is_alive: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          name: string;
          role?: string | null;
          team?: string | null;
          is_alive?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          name?: string;
          role?: string | null;
          team?: string | null;
          is_alive?: boolean;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      game_events: {
        Row: {
          id: string;
          room_id: string;
          type: string;
          message: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          type: string;
          message: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          type?: string;
          message?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_events_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_room_with_options: {
        Args: {
          p_code: string;
          p_name: string;
          p_is_visible: boolean;
          p_password: string | null;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          is_visible: boolean;
          status: RoomStatus;
          day_number: number;
          discussion_seconds: number;
          discussion_started_at: string | null;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
      update_room_options: {
        Args: {
          p_room_id: string;
          p_name: string;
          p_is_visible: boolean;
          p_password: string | null;
          p_clear_password: boolean;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          is_visible: boolean;
          status: RoomStatus;
          day_number: number;
          discussion_seconds: number;
          discussion_started_at: string | null;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
      get_host_room: {
        Args: {
          p_room_id: string;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          is_visible: boolean;
          status: RoomStatus;
          day_number: number;
          discussion_seconds: number;
          discussion_started_at: string | null;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
      get_room_state: {
        Args: {
          p_room_id: string;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          is_visible: boolean;
          status: RoomStatus;
          day_number: number;
          discussion_seconds: number;
          discussion_started_at: string | null;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
      get_room_entry: {
        Args: {
          p_code: string;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          status: RoomStatus;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
      list_visible_rooms: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          code: string;
          name: string;
          status: RoomStatus;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
      verify_room_password: {
        Args: {
          p_code: string;
          p_password: string;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          status: RoomStatus;
          has_password: boolean;
          created_at: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
