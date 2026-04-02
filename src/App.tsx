import React, { useState, useEffect } from 'react';
import {
  createSinglesGame,
  createDoublesGame,
  createSession,
  applyAction,
  undo,
  redo,
  getServer,
  getScoreAnnouncement,
  getWinner,
  setManualState,
} from './game/game';
import type {
  GameSession,
  GameType,
  GameState,
  Player,
  Team,
  CourtSide,
} from './game/types';

// ── Setup ──────────────────────────────────────────────────────────────────────

interface SetupForm {
  gameType: GameType;
  names: string[]; // 2 for singles, 4 for doubles
}

const NAMES_STORAGE_KEY = 'pickleball-player-names';
const SESSION_STORAGE_KEY = 'pickleball-session';

function defaultForm(): SetupForm {
  try {
    const saved = localStorage.getItem(NAMES_STORAGE_KEY);
    if (saved) {
      const names = JSON.parse(saved);
      if (Array.isArray(names) && names.length === 4) {
        return { gameType: 'doubles', names };
      }
    }
  } catch {
    // ignore parse errors
  }
  return { gameType: 'doubles', names: ['', '', '', ''] };
}

function SetupScreen({ onStart }: { onStart: (s: GameSession) => void }) {
  const [form, setForm] = useState<SetupForm>(defaultForm);

  function setName(i: number, value: string) {
    setForm((f) => {
      const names = [...f.names];
      names[i] = value;
      return { ...f, names };
    });
  }

  function handleStart() {
    localStorage.setItem(NAMES_STORAGE_KEY, JSON.stringify(form.names));
    const makePlayer = (name: string, idx: number): Player => ({
      id: String(idx),
      name: name.trim() || `Player ${idx + 1}`,
    });

    if (form.gameType === 'singles') {
      const p1 = makePlayer(form.names[0], 0);
      const p2 = makePlayer(form.names[1], 1);
      onStart(createSession(createSinglesGame(p1, p2)));
    } else {
      const p = [0, 1, 2, 3].map((i) => makePlayer(form.names[i], i));
      onStart(createSession(createDoublesGame([p[0], p[1]], [p[2], p[3]])));
    }
  }

  const isSingles = form.gameType === 'singles';

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6 py-12">
      <h1 className="text-4xl font-semibold tracking-tight text-(--text-h)">
        Pickleball Scorekeeper
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleStart();
        }}
        className="flex flex-col items-center gap-8 w-full"
      >
        {/* Game type */}
        <div className="flex gap-2">
          {(['doubles', 'singles'] as GameType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setForm((f) => ({ ...f, gameType: t }))}
              className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors capitalize ${
                form.gameType === t
                  ? 'bg-(--accent) text-white border-(--accent)'
                  : 'border-(--border) text-(--text) hover:border-(--accent-border)'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Player name inputs */}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {isSingles ? (
            <>
              <NameInput
                label="Player 1"
                value={form.names[0]}
                onChange={(v) => setName(0, v)}
              />
              <NameInput
                label="Player 2"
                value={form.names[1]}
                onChange={(v) => setName(1, v)}
              />
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest text-(--text) font-medium">
                Team 1
              </p>
              <NameInput
                label="Player 1"
                value={form.names[0]}
                onChange={(v) => setName(0, v)}
              />
              <NameInput
                label="Player 2"
                value={form.names[1]}
                onChange={(v) => setName(1, v)}
              />
              <p className="text-xs uppercase tracking-widest text-(--text) font-medium mt-2">
                Team 2
              </p>
              <NameInput
                label="Player 3"
                value={form.names[2]}
                onChange={(v) => setName(2, v)}
              />
              <NameInput
                label="Player 4"
                value={form.names[3]}
                onChange={(v) => setName(3, v)}
              />
            </>
          )}
        </div>

        <button
          type="submit"
          className="px-8 py-3 rounded-lg bg-(--accent) text-white font-medium text-lg hover:opacity-90 transition-opacity"
        >
          Start Game
        </button>
      </form>
    </div>
  );
}

function NameInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 rounded-lg border border-(--border) bg-transparent text-(--text-h) placeholder:text-(--text) focus:outline-none focus:border-(--accent-border) transition-colors"
    />
  );
}

// ── Game ───────────────────────────────────────────────────────────────────────

function teamLabel(team: Team): string {
  return team.players.map((p) => p.name).join(' & ');
}

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-(--bg) border border-(--border) rounded-xl p-6 max-w-xs w-full mx-4 flex flex-col gap-4 shadow-xl">
        <p className="text-(--text-h) font-medium text-center">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-(--accent) text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

function GameMenu({
  onNewGame,
  onSwapTeams,
  onEditScore,
}: {
  onNewGame: () => void;
  onSwapTeams: () => void;
  onEditScore: () => void;
}) {
  const [open, setOpen] = useState(false);

  function handleNewGame() {
    setOpen(false);
    onNewGame();
  }

  function handleSwapTeams() {
    setOpen(false);
    onSwapTeams();
  }

  function handleEditScore() {
    setOpen(false);
    onEditScore();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-(--border) text-(--text) hover:border-(--accent-border) transition-colors text-lg leading-none"
        aria-label="More options"
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-(--bg) border border-(--border) rounded-lg shadow-xl z-20 min-w-36 overflow-hidden">
            <button
              onClick={handleEditScore}
              className="w-full px-4 py-2.5 text-left text-sm text-(--text-h) hover:bg-(--accent-bg) transition-colors"
            >
              Edit Score
            </button>
            <button
              onClick={handleSwapTeams}
              className="w-full px-4 py-2.5 text-left text-sm text-(--text-h) hover:bg-(--accent-bg) transition-colors"
            >
              Swap Team Sides
            </button>
            <button
              onClick={handleNewGame}
              className="w-full px-4 py-2.5 text-left text-sm text-(--text-h) hover:bg-(--accent-bg) transition-colors"
            >
              New Game
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ManualEditModal({
  state,
  onConfirm,
  onCancel,
}: {
  state: GameState;
  onConfirm: (next: GameState) => void;
  onCancel: () => void;
}) {
  const [score0, setScore0] = useState(String(state.scores[0]));
  const [score1, setScore1] = useState(String(state.scores[1]));
  const [servingIndex, setServingIndex] = useState<0 | 1>(
    state.type === 'singles' ? state.servingPlayerIndex : state.servingTeamIndex
  );
  const [isSecondServer, setIsSecondServer] = useState(
    state.type === 'doubles' ? state.isSecondServer : false
  );

  function label0() {
    return state.type === 'singles'
      ? state.players[0].name
      : teamLabel(state.teams[0]);
  }
  function label1() {
    return state.type === 'singles'
      ? state.players[1].name
      : teamLabel(state.teams[1]);
  }

  function handleConfirm() {
    const s0 = Math.max(0, parseInt(score0, 10) || 0);
    const s1 = Math.max(0, parseInt(score1, 10) || 0);
    const scores: [number, number] = [s0, s1];
    if (state.type === 'singles') {
      onConfirm(setManualState(state, scores, servingIndex));
    } else {
      onConfirm(setManualState(state, scores, servingIndex, isSecondServer));
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-(--bg) border border-(--border) rounded-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-5 shadow-xl">
        <h2 className="text-(--text-h) font-semibold text-lg">Edit Score</h2>

        {/* Scores */}
        <div className="flex gap-3">
          {([0, 1] as const).map((i) => (
            <label key={i} className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-(--text) truncate">
                {i === 0 ? label0() : label1()}
              </span>
              <input
                type="number"
                min={0}
                value={i === 0 ? score0 : score1}
                onChange={(e) =>
                  (i === 0 ? setScore0 : setScore1)(e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-(--border) bg-transparent text-(--text-h) text-center text-xl font-mono focus:outline-none focus:border-(--accent-border) transition-colors"
              />
            </label>
          ))}
        </div>

        {/* Who is serving */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-(--text)">Serving</span>
          <div className="flex gap-2">
            {([0, 1] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setServingIndex(i)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors truncate px-2 ${
                  servingIndex === i
                    ? 'bg-(--accent) text-white border-(--accent)'
                    : 'border-(--border) text-(--text-h) hover:border-(--accent-border)'
                }`}
              >
                {i === 0 ? label0() : label1()}
              </button>
            ))}
          </div>
        </div>

        {/* Server 1 / Server 2 (doubles only) */}
        {state.type === 'doubles' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-(--text)">Server</span>
            <div className="flex gap-2">
              {([false, true] as const).map((second) => {
                const playerName =
                  state.teams[servingIndex].players[second ? 1 : 0].name;
                return (
                  <button
                    key={String(second)}
                    type="button"
                    onClick={() => setIsSecondServer(second)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isSecondServer === second
                        ? 'bg-(--accent) text-white border-(--accent)'
                        : 'border-(--border) text-(--text-h) hover:border-(--accent-border)'
                    }`}
                  >
                    {playerName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Starting positions note (doubles only) */}
        {state.type === 'doubles' && (
          <p className="text-xs text-(--text) opacity-60 leading-relaxed">
            Starting sides — {state.teams[0].players[0].name} &amp;{' '}
            {state.teams[1].players[0].name}: even &nbsp;|&nbsp;{' '}
            {state.teams[0].players[1].name} &amp;{' '}
            {state.teams[1].players[1].name}: odd
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-(--accent) text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function GameScreen({
  session,
  onAction,
  onUndo,
  onRedo,
  onNewGame,
  onRenamePlayer,
  onEditScore,
}: {
  session: GameSession;
  onAction: (a: 'serverScores' | 'serverLoses') => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewGame: () => void;
  onRenamePlayer: (id: string, name: string) => void;
  onEditScore: (next: GameState) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEditScore, setShowEditScore] = useState(false);
  const [teamsSwapped, setTeamsSwapped] = useState(false);
  const state = session.present;
  const winner = getWinner(state);
  const canUndo = session.past.length > 0;
  const canRedo = session.future.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-4 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Undo
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="px-4 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Redo →
          </button>
          <GameMenu
            onNewGame={() => setShowConfirm(true)}
            onSwapTeams={() => setTeamsSwapped((v) => !v)}
            onEditScore={() => setShowEditScore(true)}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-col items-center gap-6 px-4 py-6 overflow-y-auto flex-1">
        <CourtDiagram
          state={state}
          onRenamePlayer={onRenamePlayer}
          teamsSwapped={teamsSwapped}
        />

        {winner && (
          <div className="w-full bg-(--accent-bg) border border-(--accent-border) rounded-xl p-5 text-center">
            <p className="text-2xl font-semibold text-(--text-h) mb-1">
              {state.type === 'singles'
                ? `${(winner as Player).name} wins!`
                : `${teamLabel(winner as Team)} wins!`}
            </p>
            <p className="text-(--text) text-sm">
              {state.scores[0]} – {state.scores[1]}
            </p>
          </div>
        )}

        <PointHistory session={session} onAction={onAction} />
      </div>

      {showConfirm && (
        <ConfirmModal
          message="Start a new game? Your current game will be lost."
          onConfirm={onNewGame}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      {showEditScore && (
        <ManualEditModal
          state={state}
          onConfirm={(next) => {
            onEditScore(next);
            setShowEditScore(false);
          }}
          onCancel={() => setShowEditScore(false)}
        />
      )}
    </div>
  );
}

// ── Point history ─────────────────────────────────────────────────────────────

function PointHistory({
  session,
  onAction,
}: {
  session: GameSession;
  onAction: (a: 'serverScores' | 'serverLoses') => void;
}) {
  if (session.present.isGameOver && session.past.length === 0) return null;

  const state = session.present;
  const server = getServer(state);
  const side = getCourtPositions(state)[server.id];

  return (
    <div className="w-full">
      <div className="text-xs uppercase tracking-widest text-(--text) mb-3">
        Score Log
      </div>
      <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-(--border) text-xs">
        {/* Current state row */}
        {!state.isGameOver && (
          <>
            <span className="px-3 py-2 bg-(--accent-bg) font-bold text-left min-w-0 flex items-center">
              {server.name} serving ({side})
            </span>
            <span className="px-3 py-2 bg-(--accent-bg) font-mono text-(--text-h) font-bold text-nowrap flex items-center justify-center text-xl">
              {getScoreAnnouncement(state)}
            </span>
            <span className="px-3 py-2 bg-(--accent-bg) flex gap-2 items-center justify-end">
              <button
                onClick={() => onAction('serverScores')}
                className="px-4 py-2 rounded bg-(--accent) text-white font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Win
              </button>
              <button
                onClick={() => onAction('serverLoses')}
                className="px-4 py-2 rounded border border-(--border) text-(--text-h) font-medium text-sm hover:bg-(--bg) transition-colors"
              >
                Lose
              </button>
            </span>
          </>
        )}

        {/* Past rows */}
        {[...session.past].reverse().map((pastState, reversedI) => {
          const originalI = session.past.length - 1 - reversedI;
          const action = session.actions[originalI];
          const isManual = action === 'manualEdit';
          const won = action === 'serverScores';
          const sideOut =
            !won &&
            !isManual &&
            (pastState.type === 'singles' || pastState.isSecondServer);
          const server = getServer(pastState);
          const side = getCourtPositions(pastState)[server.id];
          const resultLabel = isManual
            ? 'edited'
            : won
              ? 'won'
              : sideOut
                ? 'side out'
                : 'lost';
          const resultClass = isManual
            ? 'text-(--text) opacity-50'
            : won
              ? 'text-(--accent)'
              : sideOut
                ? 'text-red-400'
                : 'text-(--text)';
          const stripe =
            reversedI % 2 === 0 ? 'bg-(--bg)' : 'bg-(--accent-bg)/30';
          return (
            <React.Fragment key={reversedI}>
              <span className={`px-3 py-1.5 ${stripe} text-(--text) text-left`}>
                {server.name} served ({side})
              </span>
              <span
                className={`px-3 py-1.5 ${stripe} font-mono text-(--text) text-nowrap text-center`}
              >
                {getScoreAnnouncement(pastState)}
                {isManual && (
                  <span className="text-(--text) opacity-50 ml-0.5">*</span>
                )}
              </span>
              <span
                className={`px-3 py-1.5 ${stripe} ${resultClass} text-right`}
              >
                {resultLabel}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Court diagram ──────────────────────────────────────────────────────────────

function getCourtPositions(state: GameState): Record<string, CourtSide> {
  if (state.type === 'doubles') return state.courtPositions;
  // Singles: server's side is determined by their score parity; receiver mirrors
  const side: CourtSide =
    state.scores[state.servingPlayerIndex] % 2 === 0 ? 'even' : 'odd';
  return { [state.players[0].id]: side, [state.players[1].id]: side };
}

function CourtCell({
  players,
  serverId,
  onRenamePlayer,
}: {
  players: Player[];
  serverId: string;
  onRenamePlayer: (id: string, name: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function startEdit(p: Player) {
    setEditingId(p.id);
    setDraft(p.name);
  }

  function commitEdit() {
    if (editingId && draft.trim()) {
      onRenamePlayer(editingId, draft.trim());
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingId(null);
  }

  const hasServer = players.some((p) => p.id === serverId);
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 p-3 min-h-16 flex-1 transition-colors ${
        hasServer ? 'bg-(--accent-bg)' : ''
      }`}
    >
      {players.map((p) =>
        editingId === p.id ? (
          <input
            key={p.id}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full text-xs text-center bg-transparent border-b border-(--accent) outline-none text-(--text-h) px-1"
          />
        ) : (
          <span
            key={p.id}
            onClick={() => startEdit(p)}
            className={`text-xs text-center leading-tight cursor-pointer hover:underline ${
              p.id === serverId
                ? 'text-(--accent) font-bold'
                : 'text-(--text-h) font-medium'
            }`}
          >
            {p.name}
            {p.id === serverId && ' ›'}
          </span>
        )
      )}
    </div>
  );
}

function CourtDiagram({
  state,
  onRenamePlayer,
  teamsSwapped,
}: {
  state: GameState;
  onRenamePlayer: (id: string, name: string) => void;
  teamsSwapped: boolean;
}) {
  const positions = getCourtPositions(state);
  const serverId =
    state.type === 'doubles'
      ? state.currentServerId
      : state.players[state.servingPlayerIndex].id;

  // team index 0 = top half of court, team index 1 = bottom half (swappable)
  const rawTeams: Player[][] =
    state.type === 'doubles'
      ? [
          state.teams[0].players as unknown as Player[],
          state.teams[1].players as unknown as Player[],
        ]
      : [[state.players[0]], [state.players[1]]];
  const teams = teamsSwapped ? [rawTeams[1], rawTeams[0]] : rawTeams;

  // Bird's-eye layout (team1's "even" = their right = left side of court from above):
  //  top-left  = team1/even  |  top-right  = team1/odd
  //  ===================NET===================
  //  bot-left  = team0/odd   |  bot-right  = team0/even
  function playersIn(teamIdx: 0 | 1, side: CourtSide): Player[] {
    return teams[teamIdx].filter((p) => positions[p.id] === side);
  }

  const topScore = teamsSwapped ? state.scores[1] : state.scores[0];
  const bottomScore = teamsSwapped ? state.scores[0] : state.scores[1];

  return (
    <div className="w-full border-2 border-(--border) rounded-xl overflow-hidden">
      {/* Team 0 (top) */}
      <div className="relative">
        <div className="flex divide-x-2 divide-(--border)">
          <CourtCell
            players={playersIn(0, 'even')}
            serverId={serverId}
            onRenamePlayer={onRenamePlayer}
          />
          <CourtCell
            players={playersIn(0, 'odd')}
            serverId={serverId}
            onRenamePlayer={onRenamePlayer}
          />
        </div>
        <div className="absolute right-3 inset-y-0 flex items-center pointer-events-none">
          <span className="text-4xl font-bold text-(--text-h) opacity-30">
            {topScore}
          </span>
        </div>
      </div>
      {/* Net */}
      <div className="flex items-center gap-2 px-3 py-1 border-y-2 border-(--accent) bg-(--accent-bg)">
        <div className="flex-1 border-t border-dashed border-(--accent-border)" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-(--accent)">
          net
        </span>
        <div className="flex-1 border-t border-dashed border-(--accent-border)" />
      </div>
      {/* Team 1 (bottom) */}
      <div className="relative">
        <div className="flex divide-x-2 divide-(--border)">
          <CourtCell
            players={playersIn(1, 'odd')}
            serverId={serverId}
            onRenamePlayer={onRenamePlayer}
          />
          <CourtCell
            players={playersIn(1, 'even')}
            serverId={serverId}
            onRenamePlayer={onRenamePlayer}
          />
        </div>
        <div className="absolute right-3 inset-y-0 flex items-center pointer-events-none">
          <span className="text-4xl font-bold text-(--text-h) opacity-30">
            {bottomScore}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

function renamePlayerInState(
  state: GameState,
  id: string,
  name: string
): GameState {
  if (state.type === 'singles') {
    return {
      ...state,
      players: state.players.map((p) => (p.id === id ? { ...p, name } : p)) as [
        Player,
        Player,
      ],
    };
  }
  return {
    ...state,
    teams: state.teams.map((team) => ({
      ...team,
      players: team.players.map((p) => (p.id === id ? { ...p, name } : p)) as [
        Player,
        Player,
      ],
    })) as [Team, Team],
  };
}

export default function App() {
  const [session, setSession] = useState<GameSession | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as GameSession) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session]);

  if (!session) {
    return <SetupScreen onStart={setSession} />;
  }

  function handleRenamePlayer(id: string, name: string) {
    setSession((s) => {
      if (!s) return s;
      return {
        ...s,
        past: s.past.map((state) => renamePlayerInState(state, id, name)),
        present: renamePlayerInState(s.present, id, name),
        future: s.future.map((state) => renamePlayerInState(state, id, name)),
      };
    });
  }

  function handleEditScore(next: GameState) {
    setSession((s) => {
      if (!s) return s;
      return {
        ...s,
        past: [...s.past, s.present],
        present: next,
        future: [],
        actions: [...s.actions, 'manualEdit' as const],
        undoneActions: [],
      };
    });
  }

  return (
    <GameScreen
      session={session}
      onAction={(action) => setSession((s) => s && applyAction(s, action))}
      onUndo={() => setSession((s) => s && undo(s))}
      onRedo={() => setSession((s) => s && redo(s))}
      onNewGame={() => setSession(null)}
      onRenamePlayer={handleRenamePlayer}
      onEditScore={handleEditScore}
    />
  );
}
