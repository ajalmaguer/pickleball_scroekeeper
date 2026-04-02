export type CourtSide = 'even' | 'odd';
export type GameType = 'singles' | 'doubles';

export interface Player {
  id: string;
  name: string;
}

export interface Team {
  players: [Player, Player]; // [0] starts on even side, [1] starts on odd side
}

export interface GameConfig {
  pointsToWin: number; // default 11
  winByPoints: number; // default 2
}

// Maps player.id → current court side
export type CourtPositions = Record<string, CourtSide>;

export interface SinglesState {
  type: 'singles';
  config: GameConfig;
  players: [Player, Player];
  scores: [number, number]; // parallel to players
  servingPlayerIndex: 0 | 1;
  isGameOver: boolean;
}

export interface DoublesState {
  type: 'doubles';
  config: GameConfig;
  teams: [Team, Team];
  scores: [number, number]; // parallel to teams
  servingTeamIndex: 0 | 1;
  isSecondServer: boolean; // true = server 1 already used this possession
  currentServerId: string; // id of the player currently serving
  courtPositions: CourtPositions;
  isGameOver: boolean;
}

export type GameState = SinglesState | DoublesState;

export type GameAction = 'serverScores' | 'serverLoses' | 'manualEdit';

export interface GameSession {
  past: GameState[]; // stack of previous states
  present: GameState; // current state
  future: GameState[]; // stack of undone states (for redo)
  actions: GameAction[]; // actions taken so far (parallel to past; length === past.length)
  undoneActions: GameAction[]; // actions that were undone (parallel to future; enables redo to restore the log)
}
