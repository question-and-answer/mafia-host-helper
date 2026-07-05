import type { RoomStatus } from "./game";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          code: string;
          status: RoomStatus;
          day_number: number;
          discussion_seconds: number;
          discussion_started_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          status?: RoomStatus;
          day_number?: number;
          discussion_seconds?: number;
          discussion_started_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
