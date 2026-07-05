export type RoomStatus =
  | "waiting"
  | "assigned"
  | "revealed"
  | "day"
  | "night"
  | "voting"
  | "ended";

export type RoleCounts = Record<string, number>;

export type Room = {
  id: string;
  code: string;
  status: RoomStatus;
  day_number: number;
  discussion_seconds: number;
  discussion_started_at: string | null;
  created_at: string | null;
};

export type Player = {
  id: string;
  room_id: string;
  name: string;
  role: string | null;
  team: string | null;
  is_alive: boolean;
  created_at: string | null;
};

export type GameEvent = {
  id: string;
  room_id: string;
  type: string;
  message: string;
  created_at: string | null;
};
