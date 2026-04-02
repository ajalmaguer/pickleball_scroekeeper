import { useState } from 'react';
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

function defaultForm(): SetupForm {
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

function GameScreen({
  session,
  onAction,
  onUndo,
  onRedo,
  onNewGame,
  onRenamePlayer,
}: {
  session: GameSession;
  onAction: (a: 'serverScores' | 'serverLoses') => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewGame: () => void;
  onRenamePlayer: (id: string, name: string) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const state = session.present;
  const server = getWinner(state) ? null : getServer(state);
  const announcement = getScoreAnnouncement(state);
  const winner = getWinner(state);
  const canUndo = session.past.length > 0;
  const canRedo = session.future.length > 0;

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6 py-10">
      <h2 className="text-lg font-medium text-(--text) uppercase tracking-widest">
        {state.type === 'singles' ? 'Singles' : 'Doubles'}
      </h2>

      {/* Court diagram */}
      <CourtDiagram state={state} onRenamePlayer={onRenamePlayer} />

      {/* Score announcement */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-(--text) mb-1">
          Score call
        </p>
        <p className="text-4xl font-mono font-semibold text-(--text-h)">
          {announcement}
        </p>
      </div>

      {/* Server info */}
      {server && (
        <p className="text-sm text-(--text)">
          Serving:{' '}
          <span className="text-(--text-h) font-medium">{server.name}</span>
          {state.type === 'doubles' && (
            <span className="ml-1 text-(--text)">
              (server {state.isSecondServer ? '2' : '1'})
            </span>
          )}
        </p>
      )}

      {/* Game over banner */}
      {winner && (
        <div className="w-full max-w-sm bg-(--accent-bg) border border-(--accent-border) rounded-xl p-5 text-center">
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

      {/* Action buttons */}
      {!winner && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => onAction('serverScores')}
            className="py-4 rounded-xl bg-(--accent) text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Server Scores
          </button>
          <button
            onClick={() => onAction('serverLoses')}
            className="py-4 rounded-xl border-2 border-(--accent-border) text-(--text-h) font-semibold text-lg hover:bg-(--accent-bg) transition-colors"
          >
            Server Loses
          </button>
        </div>
      )}

      {/* Undo / Redo / New game */}
      <div className="flex gap-3">
        {canUndo && (
          <button
            onClick={onUndo}
            className="px-5 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors"
          >
            ← Undo
          </button>
        )}
        {canRedo && (
          <button
            onClick={onRedo}
            className="px-5 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors"
          >
            Redo →
          </button>
        )}
        <button
          onClick={() => setShowConfirm(true)}
          className="px-5 py-2 rounded-lg border border-(--border) text-sm text-(--text) hover:border-(--accent-border) transition-colors"
        >
          New Game
        </button>
      </div>

      <PointHistory session={session} />

      {showConfirm && (
        <ConfirmModal
          message="Start a new game? Your current game will be lost."
          onConfirm={onNewGame}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ── Point history ─────────────────────────────────────────────────────────────

function PointHistory({ session }: { session: GameSession }) {
  if (session.past.length === 0) return null;

  return (
    <div className="w-full max-w-xs">
      <p className="text-xs uppercase tracking-widest text-(--text) mb-2">
        History
      </p>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-4 gap-y-1 max-h-48 overflow-y-auto text-xs">
        {(() => {
          const state = session.present;
          if (state.isGameOver) return null;
          const server = getServer(state);
          const side = getCourtPositions(state)[server.id];
          return (
            <>
              <span className="text-left text-nowrap text-(--text-h) font-medium">{server.name} serving ({side})</span>
              <span className="font-mono text-(--text) text-center">{getScoreAnnouncement(state)}</span>
              <span />
            </>
          );
        })()}
        {[...session.past].reverse().map((state, reversedI) => {
          const originalI = session.past.length - 1 - reversedI;
          const action = session.actions[originalI];
          const won = action === 'serverScores';
          const sideOut = !won && (state.type === 'singles' || state.isSecondServer);
          const server = getServer(state);
          const side = getCourtPositions(state)[server.id];
          const resultLabel = won ? 'won' : sideOut ? 'side out' : 'lost';
          const resultClass = won ? 'text-(--accent)' : sideOut ? 'text-red-400' : 'text-(--text)';
          return (
            <>
              <span key={`name-${reversedI}`} className="text-left text-nowrap">
                {server.name} served ({side})
              </span>
              <span
                key={`score-${reversedI}`}
                className="font-mono text-(--text) text-center"
              >
                {getScoreAnnouncement(state)}
              </span>
              <span key={`result-${reversedI}`} className={resultClass}>
                {resultLabel}
              </span>
            </>
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
            className={`text-xs font-medium text-center leading-tight cursor-pointer hover:underline ${
              p.id === serverId ? 'text-(--accent)' : 'text-(--text-h)'
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
}: {
  state: GameState;
  onRenamePlayer: (id: string, name: string) => void;
}) {
  const positions = getCourtPositions(state);
  const serverId =
    state.type === 'doubles'
      ? state.currentServerId
      : state.players[state.servingPlayerIndex].id;

  // team index 0 = bottom half of court, team index 1 = top half
  const teams: Player[][] =
    state.type === 'doubles'
      ? [
          state.teams[0].players as unknown as Player[],
          state.teams[1].players as unknown as Player[],
        ]
      : [[state.players[0]], [state.players[1]]];

  // Bird's-eye layout (team1's "even" = their right = left side of court from above):
  //  top-left  = team1/even  |  top-right  = team1/odd
  //  ===================NET===================
  //  bot-left  = team0/odd   |  bot-right  = team0/even
  function playersIn(teamIdx: 0 | 1, side: CourtSide): Player[] {
    return teams[teamIdx].filter((p) => positions[p.id] === side);
  }

  return (
    <div className="w-full max-w-xs border-2 border-(--border) rounded-xl overflow-hidden">
      {/* Team 0 (top) */}
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
      {/* Net */}
      <div className="flex items-center gap-2 px-3 py-1 border-y-2 border-(--accent) bg-(--accent-bg)">
        <div className="flex-1 border-t border-dashed border-(--accent-border)" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-(--accent)">
          net
        </span>
        <div className="flex-1 border-t border-dashed border-(--accent-border)" />
      </div>
      {/* Team 1 (bottom) */}
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
  const [session, setSession] = useState<GameSession | null>(null);

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

  return (
    <GameScreen
      session={session}
      onAction={(action) => setSession((s) => s && applyAction(s, action))}
      onUndo={() => setSession((s) => s && undo(s))}
      onRedo={() => setSession((s) => s && redo(s))}
      onNewGame={() => setSession(null)}
      onRenamePlayer={handleRenamePlayer}
    />
  );
}
