export type EventType =
  | "GameTime"
  | "Try"
  | "Goal"
  | "GoalMissed"
  | "Penalty"
  | "Error"
  | "Interchange"
  | "LineBreak"
  | "RuckInfringement"
  | "SetRestart"
  | "KickBomb"
  | "LineDropout"
  | "OffsideWithinTenMetres"
  | "CaptainsChallenge"
  | "PenaltyShot";

export interface TimelineEvent {
  title: string;
  type: EventType | string;
  gameSeconds: number;
  playerId?: number;
  teamId?: number;
  offPlayerId?: number;
  homeScore?: number;
  awayScore?: number;
  content?: string;
  description?: string;
}

export interface Player {
  firstName: string;
  lastName: string;
  position: string;
  playerId: number;
  number: number;
  isCaptain?: boolean;
  isOnField?: boolean;
  headImage?: string;
}

export interface Team {
  nickName: string;
  teamId: number;
  score: number;
  players: Player[];
}

export interface MatchData {
  matchId: number;
  roundTitle: string;
  startTime: string;
  venue: string;
  venueCity: string;
  matchState: string;
  matchMode: string;
  hasOnFieldTracking: boolean;
  showPlayerPositions: boolean;
  homeTeam: Team;
  awayTeam: Team;
  timeline: TimelineEvent[];
}

export type Side = "home" | "away";
