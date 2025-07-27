export enum GameState {
  JOIN,
  LOBBY,
  ROUND_STARTING,
  BRIEFING,
  PROMPTING,
  GENERATING,
  SCORING,
  GALLERY,
  REVEAL,
  GAME_OVER,
}

export type PlayerRole = 'Artist' | 'Dodger';

export interface Player {
  id: string; // Corresponds to socket.id
  name: string;
  role: PlayerRole;
  score: number;
  promptSubmitted: boolean;
}

export interface Artwork {
  id: number;
  playerId: string;
  prompt: string;
  imageUrl: string | null;
  isDodger: boolean;
  qualityScore?: number;
  originalityScore?: number;
}

export interface Vote {
  voterId: string;
  artworkId: number;
  isYes: boolean;
}

export interface RoundData {
  theme: string;
  motif1: string;
  motif2: string;
}

// This represents the full game state sent from server to client
export interface ServerGameState {
  state: GameState;
  players: Player[];
  currentRound: number;
  roundData: RoundData | null;
  artworks: Artwork[];
  votes: Vote[];
  galleryIndex: number;
  galleryTime: number;
  roundPoints: number;
  userCorrectlyIdentifiedDodger?: boolean; // Will be set per-player on reveal
  dodgerId?: string | null;
}
