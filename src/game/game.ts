import type {
  Player,
  Team,
  GameConfig,
  CourtSide,
  SinglesState,
  DoublesState,
  GameState,
  GameAction,
  GameSession,
} from './types';

const DEFAULT_CONFIG: GameConfig = {
  pointsToWin: 11,
  winByPoints: 2,
};

// ── Factories ──────────────────────────────────────────────────────────────────

export function createSinglesGame(
  player1: Player,
  player2: Player,
  config?: Partial<GameConfig>
): SinglesState {
  return {
    type: 'singles',
    config: { ...DEFAULT_CONFIG, ...config },
    players: [player1, player2],
    scores: [0, 0],
    servingPlayerIndex: 0,
    isGameOver: false,
  };
}

export function createDoublesGame(
  team1: [Player, Player],
  team2: [Player, Player],
  config?: Partial<GameConfig>
): DoublesState {
  return {
    type: 'doubles',
    config: { ...DEFAULT_CONFIG, ...config },
    teams: [{ players: team1 }, { players: team2 }],
    scores: [0, 0],
    servingTeamIndex: 0,
    isSecondServer: true, // start-of-game rule: first serving team only gets one server
    currentServerId: team1[0].id, // team1[0] starts on even side; score 0 is even → they serve
    courtPositions: {
      [team1[0].id]: 'even',
      [team1[1].id]: 'odd',
      [team2[0].id]: 'even',
      [team2[1].id]: 'odd',
    },
    isGameOver: false,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function checkIsGameOver(
  scores: [number, number],
  config: GameConfig
): boolean {
  return scores.some(
    (s, i) => s >= config.pointsToWin && s - scores[1 - i] >= config.winByPoints
  );
}

function flipSide(side: CourtSide): CourtSide {
  return side === 'even' ? 'odd' : 'even';
}

// ── Core actions ───────────────────────────────────────────────────────────────

export function serverScores(state: SinglesState): SinglesState;
export function serverScores(state: DoublesState): DoublesState;
export function serverScores(state: GameState): GameState;
export function serverScores(state: GameState): GameState {
  if (state.isGameOver) return state;

  if (state.type === 'singles') {
    const scores: [number, number] = [...state.scores] as [number, number];
    scores[state.servingPlayerIndex] += 1;
    return {
      ...state,
      scores,
      isGameOver: checkIsGameOver(scores, state.config),
    };
  }

  // Doubles: serving team scores and players on that team switch sides
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[state.servingTeamIndex] += 1;

  const servingTeamPlayers = state.teams[state.servingTeamIndex].players;
  const courtPositions = { ...state.courtPositions };
  for (const player of servingTeamPlayers) {
    courtPositions[player.id] = flipSide(courtPositions[player.id]);
  }

  return {
    ...state,
    scores,
    courtPositions,
    isGameOver: checkIsGameOver(scores, state.config),
  };
}

export function serverLoses(state: SinglesState): SinglesState;
export function serverLoses(state: DoublesState): DoublesState;
export function serverLoses(state: GameState): GameState;
export function serverLoses(state: GameState): GameState {
  if (state.isGameOver) return state;

  if (state.type === 'singles') {
    return {
      ...state,
      servingPlayerIndex: state.servingPlayerIndex === 0 ? 1 : 0,
    };
  }

  // Doubles: move to server 2, or side-out to other team
  if (!state.isSecondServer) {
    // Server 1 lost — partner becomes server 2 (no position change)
    const servingTeam = state.teams[state.servingTeamIndex];
    const server2 = servingTeam.players.find((p) => p.id !== state.currentServerId)!;
    return { ...state, isSecondServer: true, currentServerId: server2.id };
  }

  // True side-out — serve passes to other team, their server 1 is on the score-parity side
  const newTeamIndex = state.servingTeamIndex === 0 ? 1 : 0;
  const newTeam = state.teams[newTeamIndex];
  const newScore = state.scores[newTeamIndex];
  const server1Side: CourtSide = newScore % 2 === 0 ? 'even' : 'odd';
  const server1 = newTeam.players.find((p) => state.courtPositions[p.id] === server1Side)!;
  return {
    ...state,
    servingTeamIndex: newTeamIndex,
    isSecondServer: false,
    currentServerId: server1.id,
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function getServer(state: GameState): Player {
  if (state.type === 'singles') {
    return state.players[state.servingPlayerIndex];
  }

  const allPlayers = state.teams.flatMap((t) => t.players);
  const server = allPlayers.find((p) => p.id === state.currentServerId);
  if (!server) throw new Error(`Server with id ${state.currentServerId} not found`);
  return server;
}

export function getPlayerSide(state: DoublesState, player: Player): CourtSide {
  const side = state.courtPositions[player.id];
  if (!side)
    throw new Error(`Player ${player.id} not found in court positions`);
  return side;
}

export function getScoreAnnouncement(state: GameState): string {
  if (state.type === 'singles') {
    const serving = state.scores[state.servingPlayerIndex];
    const receiving = state.scores[1 - state.servingPlayerIndex];
    return `${serving}-${receiving}`;
  }

  const serving = state.scores[state.servingTeamIndex];
  const receiving = state.scores[1 - state.servingTeamIndex];
  const serverNumber = state.isSecondServer ? 2 : 1;
  return `${serving}-${receiving}-${serverNumber}`;
}

export function getWinner(state: SinglesState): Player | null;
export function getWinner(state: DoublesState): Team | null;
export function getWinner(state: GameState): Player | Team | null;
export function getWinner(state: GameState): Player | Team | null {
  if (!state.isGameOver) return null;

  const winnerIndex = state.scores.findIndex(
    (s, i) =>
      s >= state.config.pointsToWin &&
      s - state.scores[1 - i] >= state.config.winByPoints
  );

  if (winnerIndex === -1) return null;

  if (state.type === 'singles') return state.players[winnerIndex];
  return state.teams[winnerIndex];
}

// ── Session (undo/redo/history) ────────────────────────────────────────────────

export function createSession(state: GameState): GameSession {
  return {
    past: [],
    present: state,
    future: [],
    actions: [],
    undoneActions: [],
  };
}

export function applyAction(
  session: GameSession,
  action: GameAction
): GameSession {
  const next =
    action === 'serverScores'
      ? serverScores(session.present)
      : serverLoses(session.present);

  // If state didn't change (e.g. game already over), don't push to history
  if (next === session.present) return session;

  return {
    past: [...session.past, session.present],
    present: next,
    future: [],
    actions: [...session.actions, action],
    undoneActions: [],
  };
}

export function undo(session: GameSession): GameSession {
  if (session.past.length === 0) return session;

  const previous = session.past[session.past.length - 1];
  const lastAction = session.actions[session.actions.length - 1];

  return {
    past: session.past.slice(0, -1),
    present: previous,
    future: [session.present, ...session.future],
    actions: session.actions.slice(0, -1),
    undoneActions: [lastAction, ...session.undoneActions],
  };
}

export function redo(session: GameSession): GameSession {
  if (session.future.length === 0) return session;

  const next = session.future[0];
  const redoneAction = session.undoneActions[0];

  return {
    past: [...session.past, session.present],
    present: next,
    future: session.future.slice(1),
    actions: [...session.actions, redoneAction],
    undoneActions: session.undoneActions.slice(1),
  };
}
