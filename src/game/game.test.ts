import { describe, it, expect } from 'vitest';
import {
  createSinglesGame,
  createDoublesGame,
  createSession,
  applyAction,
  undo,
  redo,
  serverScores,
  serverLoses,
  getServer,
  getPlayerSide,
  getScoreAnnouncement,
  getWinner,
  setManualState,
} from './game';
import type { Player, DoublesState, SinglesState, GameState } from './types';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const p1: Player = { id: 'p1', name: 'Alice' };
const p2: Player = { id: 'p2', name: 'Bob' };
const p3: Player = { id: 'p3', name: 'Carol' };
const p4: Player = { id: 'p4', name: 'Dave' };

// team1: [p1 (even), p2 (odd)]
// team2: [p3 (even), p4 (odd)]

// ── createSinglesGame ──────────────────────────────────────────────────────────

describe('createSinglesGame', () => {
  it('initialises scores to 0-0', () => {
    const state = createSinglesGame(p1, p2);
    expect(state.scores).toEqual([0, 0]);
  });

  it('player 1 serves first', () => {
    const state = createSinglesGame(p1, p2);
    expect(state.servingPlayerIndex).toBe(0);
    expect(getServer(state)).toEqual(p1);
  });

  it('isGameOver is false', () => {
    expect(createSinglesGame(p1, p2).isGameOver).toBe(false);
  });

  it('respects custom pointsToWin config', () => {
    const state = createSinglesGame(p1, p2, { pointsToWin: 21 });
    expect(state.config.pointsToWin).toBe(21);
  });

  it('isGameOver is false', () => {
    expect(createSinglesGame(p1, p2).isGameOver).toBe(false);
  });
});

// ── createDoublesGame ──────────────────────────────────────────────────────────

describe('createDoublesGame', () => {
  it('initialises scores to 0-0', () => {
    const state = createDoublesGame([p1, p2], [p3, p4]);
    expect(state.scores).toEqual([0, 0]);
  });

  it('team 1 serves first', () => {
    const state = createDoublesGame([p1, p2], [p3, p4]);
    expect(state.servingTeamIndex).toBe(0);
  });

  it('starts with isSecondServer true (start-of-game rule)', () => {
    const state = createDoublesGame([p1, p2], [p3, p4]);
    expect(state.isSecondServer).toBe(true);
  });

  it('assigns correct initial court positions', () => {
    const state = createDoublesGame([p1, p2], [p3, p4]);
    expect(getPlayerSide(state, p1)).toBe('even');
    expect(getPlayerSide(state, p2)).toBe('odd');
    expect(getPlayerSide(state, p3)).toBe('even');
    expect(getPlayerSide(state, p4)).toBe('odd');
  });

  it('isGameOver is false', () => {
    expect(createDoublesGame([p1, p2], [p3, p4]).isGameOver).toBe(false);
  });
});

// ── Doubles: start-of-game rule ────────────────────────────────────────────────

describe('doubles start-of-game rule', () => {
  it('team 1 starts with isSecondServer true', () => {
    const state = createDoublesGame([p1, p2], [p3, p4]);
    expect(state.servingTeamIndex).toBe(0);
    expect(state.isSecondServer).toBe(true);
  });

  it('first serverLoses immediately gives serve to team 2', () => {
    const state = serverLoses(createDoublesGame([p1, p2], [p3, p4]));
    expect(state.servingTeamIndex).toBe(1);
  });

  it('team 2 begins their first possession with isSecondServer false', () => {
    const state = serverLoses(createDoublesGame([p1, p2], [p3, p4]));
    expect(state.isSecondServer).toBe(false);
  });

  it('team 2 gets two servers before side-out', () => {
    let state = serverLoses(createDoublesGame([p1, p2], [p3, p4]));
    // server 1 loses
    state = serverLoses(state);
    expect(state.servingTeamIndex).toBe(1); // still team 2
    expect(state.isSecondServer).toBe(true);
    // server 2 loses
    state = serverLoses(state);
    expect(state.servingTeamIndex).toBe(0); // back to team 1
  });
});

// ── Singles: scorePoint ────────────────────────────────────────────────────────

describe('singles scorePoint', () => {
  it('increments serving player score', () => {
    const state = serverScores(createSinglesGame(p1, p2));
    expect(state.scores[0]).toBe(1);
    expect(state.scores[1]).toBe(0);
  });

  it('serving player does not change after scoring', () => {
    const state = serverScores(createSinglesGame(p1, p2));
    expect(state.servingPlayerIndex).toBe(0);
  });

  it('consecutive scorePoints accumulate on serving player', () => {
    let state = createSinglesGame(p1, p2);
    state = serverScores(state);
    state = serverScores(state);
    expect(state.scores[0]).toBe(2);
    expect(state.scores[1]).toBe(0);
  });
});

// ── Singles: serverLoses ───────────────────────────────────────────────────────────

describe('singles serverLoses', () => {
  it('flips the serving player', () => {
    let state = createSinglesGame(p1, p2);
    expect(state.servingPlayerIndex).toBe(0);
    expect(getServer(state)).toEqual(p1);
    state = serverLoses(state);
    expect(state.servingPlayerIndex).toBe(1);
    expect(getServer(state)).toEqual(p2);
  });

  it('does not change scores', () => {
    const state = serverLoses(createSinglesGame(p1, p2));
    expect(state.scores).toEqual([0, 0]);
  });

  it('double serverLoses returns to original server', () => {
    let state = createSinglesGame(p1, p2);
    state = serverLoses(state);
    state = serverLoses(state);
    expect(state.servingPlayerIndex).toBe(0);
  });
});

// ── Doubles: scorePoint ────────────────────────────────────────────────────────

describe('doubles scorePoint', () => {
  it('increments serving team score', () => {
    const state = serverScores(createDoublesGame([p1, p2], [p3, p4]));
    expect(state.scores[0]).toBe(1);
    expect(state.scores[1]).toBe(0);
  });

  it('serving team players switch sides after scoring', () => {
    let state = createDoublesGame([p1, p2], [p3, p4]);
    expect(getPlayerSide(state, p1)).toBe('even');
    expect(getPlayerSide(state, p2)).toBe('odd');
    expect(getPlayerSide(state, p3)).toBe('even');
    expect(getPlayerSide(state, p4)).toBe('odd');

    state = serverScores(state);
    // scoring team players flip
    expect(getPlayerSide(state, p1)).toBe('odd');
    expect(getPlayerSide(state, p2)).toBe('even');
    // Non-serving team players stay put
    expect(getPlayerSide(state, p3)).toBe('even');
    expect(getPlayerSide(state, p4)).toBe('odd');
  });

  it('isSecondServer does not change after scoring', () => {
    const before = createDoublesGame([p1, p2], [p3, p4]);
    const after = serverScores(before);
    expect(after.isSecondServer).toBe(before.isSecondServer);
  });

  it('same player remains server after winning a point (side-switch invariant)', () => {
    // At score 0 (even), server is on even side → p1
    const initial = createDoublesGame([p1, p2], [p3, p4]);
    expect(getServer(initial)).toEqual(p1);

    // After scoring: score becomes 1 (odd), p1 moved to odd side → p1 still serves
    const after = serverScores(initial);
    expect(getServer(after)).toEqual(p1);
    expect(getPlayerSide(after, p1)).toBe('odd');
  });
});

// ── Doubles: serverLoses from server 1 ────────────────────────────────────────────

describe('doubles serverLoses from server 1', () => {
  // Need a state where isSecondServer = false (team 2 serving after receiving serve)
  function stateWithServer1(): DoublesState {
    // Give serve to team 2 (they start with isSecondServer = false)
    return serverLoses(createDoublesGame([p1, p2], [p3, p4]));
  }

  it('flips isSecondServer to true', () => {
    const state = serverLoses(stateWithServer1());
    expect(state.isSecondServer).toBe(true);
  });

  it('does not change serving team', () => {
    const before = stateWithServer1();
    const after = serverLoses(before);
    expect(after.servingTeamIndex).toBe(before.servingTeamIndex);
  });

  it('does not change court positions', () => {
    const before = stateWithServer1();
    const after = serverLoses(before);
    expect(after.courtPositions).toEqual(before.courtPositions);
  });

  it('getServer returns server 2 (the partner) after server 1 loses', () => {
    const server1State = stateWithServer1(); // team 2 serving; p3 is server 1
    expect(getServer(server1State)).toEqual(p3);
    const server2State = serverLoses(server1State);
    expect(getServer(server2State)).toEqual(p4); // partner takes over, no position change
  });

  it('does not change scores', () => {
    const before = stateWithServer1();
    const after = serverLoses(before);
    expect(after.scores).toEqual(before.scores);
  });
});

// ── Doubles: serverLoses from server 2 ────────────────────────────────────────────

describe('doubles serverLoses from server 2', () => {
  function stateWithServer2(): DoublesState {
    // createDoublesGame starts with isSecondServer: true (start-of-game rule)
    return createDoublesGame([p1, p2], [p3, p4]);
  }

  it('flips serving team', () => {
    const before = stateWithServer2();
    const after = serverLoses(before);
    expect(after.servingTeamIndex).toBe(1); // serve passes to team 2
  });

  it('resets isSecondServer to false', () => {
    const after = serverLoses(stateWithServer2());
    expect(after.isSecondServer).toBe(false);
  });

  it('does not change scores', () => {
    const before = stateWithServer2();
    const after = serverLoses(before);
    expect(after.scores).toEqual(before.scores);
  });

  it('does not change court positions', () => {
    const before = stateWithServer2();
    const after = serverLoses(before);
    expect(after.courtPositions).toEqual(before.courtPositions);
  });
});

// ── Score announcements ────────────────────────────────────────────────────────

describe('getScoreAnnouncement', () => {
  describe('singles getScoreAnnouncement', () => {
    it('"serving-receiving"', () => {
      const state = createSinglesGame(p1, p2);
      expect(getScoreAnnouncement(state)).toBe('0-0');
    });

    it('reflects serving/receiving order correctly after serverLoses', () => {
      // p1 scores 5, then serverLoses → p2 serves with 0, p1 has 5
      let state: GameState = createSinglesGame(p1, p2);
      for (let i = 0; i < 5; i++) state = serverScores(state);
      state = serverLoses(state);
      expect(getScoreAnnouncement(state)).toBe('0-5'); // p2 serving with 0, p1 receiving with 5
    });
  });

  describe('doubles getScoreAnnouncement', () => {
    it('"serving-receiving-serverNumber"', () => {
      const state = createDoublesGame([p1, p2], [p3, p4]);
      // isSecondServer = true at start → server 2
      expect(getScoreAnnouncement(state)).toBe('0-0-2');
    });

    it('shows server 1 after team 2 gets serve', () => {
      const state = serverLoses(createDoublesGame([p1, p2], [p3, p4]));
      expect(getScoreAnnouncement(state)).toBe('0-0-1');
    });

    it('works for a few points', () => {
      let state: GameState = createDoublesGame([p1, p2], [p3, p4]);
      state = serverScores(state);
      expect(getScoreAnnouncement(state)).toBe('1-0-2');
      state = serverScores(state);
      expect(getScoreAnnouncement(state)).toBe('2-0-2');

      state = serverLoses(state);
      expect(getScoreAnnouncement(state)).toBe('0-2-1');
      state = serverScores(state);
      expect(getScoreAnnouncement(state)).toBe('1-2-1');

      state = serverLoses(state);
      expect(getScoreAnnouncement(state)).toBe('1-2-2');

      state = serverLoses(state);
      expect(getScoreAnnouncement(state)).toBe('2-1-1');
    });
  });
});

// ── Game over / winner ─────────────────────────────────────────────────────────

describe('isGameOver and getWinner', () => {
  describe('singles', () => {
    function singlesAtScore(s0: number, s1: number): SinglesState {
      // Directly construct state at a given score for testing win conditions
      return {
        type: 'singles',
        config: { pointsToWin: 11, winByPoints: 2 },
        players: [p1, p2],
        scores: [s0, s1],
        servingPlayerIndex: 0,
        isGameOver: false,
      };
    }

    it('not over at 10-9', () => {
      const state = serverScores(singlesAtScore(10, 9));
      expect(state.isGameOver).toBe(true); // 11-9 IS over
    });

    it('not over at 10-10 after scoring to 11-10', () => {
      const state = serverScores(singlesAtScore(10, 10));
      expect(state.isGameOver).toBe(false); // 11-10, margin only 1
    });

    it('over at 11-9', () => {
      const state = serverScores(singlesAtScore(10, 9));
      expect(state.isGameOver).toBe(true);
    });

    it('over at 12-10', () => {
      const state = serverScores(singlesAtScore(11, 10));
      expect(state.isGameOver).toBe(true); // 12-10, margin = 2
    });

    it('getWinner returns null when not over', () => {
      expect(getWinner(createSinglesGame(p1, p2))).toBeNull();
    });

    it('getWinner returns correct player', () => {
      const state = serverScores(singlesAtScore(10, 9));
      expect(getWinner(state)).toEqual(p1);
    });

    it('scorePoint is a no-op after game over', () => {
      const over = serverScores(singlesAtScore(10, 9));
      const after = serverScores(over);
      expect(after.scores).toEqual(over.scores);
    });

    it('serverLoses is a no-op after game over', () => {
      const over = serverScores(singlesAtScore(10, 9));
      const after = serverLoses(over);
      expect(after.servingPlayerIndex).toBe(over.servingPlayerIndex);
    });
  });

  describe('doubles', () => {
    it('getWinner returns correct team', () => {
      const base = createDoublesGame([p1, p2], [p3, p4]);
      const state: DoublesState = {
        ...base,
        scores: [11, 9],
        isGameOver: true,
      };
      expect(getWinner(state)).toEqual(state.teams[0]);
    });
  });
});

// ── Session: createSession ─────────────────────────────────────────────────────

describe('createSession', () => {
  it('starts with empty past, future, actions, and undoneActions', () => {
    const session = createSession(createSinglesGame(p1, p2));
    expect(session.past).toEqual([]);
    expect(session.future).toEqual([]);
    expect(session.actions).toEqual([]);
    expect(session.undoneActions).toEqual([]);
  });

  it('present is the initial state', () => {
    const state = createSinglesGame(p1, p2);
    expect(createSession(state).present).toBe(state);
  });
});

// ── Session: applyAction ───────────────────────────────────────────────────────

describe('applyAction', () => {
  it('scorePoint advances present and records action', () => {
    const session = applyAction(
      createSession(createSinglesGame(p1, p2)),
      'serverScores'
    );
    expect(session.present.scores[0]).toBe(1);
    expect(session.actions).toEqual(['serverScores']);
    expect(session.past).toHaveLength(1);
    expect(session.future).toEqual([]);
  });

  it('serverLoses advances present and records action', () => {
    const session = applyAction(
      createSession(createSinglesGame(p1, p2)),
      'serverLoses'
    );
    expect(getServer(session.present)).toEqual(p2);
    expect(session.actions).toEqual(['serverLoses']);
  });

  it('applying an action clears future', () => {
    let session = createSession(createSinglesGame(p1, p2));
    session = applyAction(session, 'serverScores');
    session = undo(session);
    expect(session.future).toHaveLength(1);
    session = applyAction(session, 'serverLoses'); // new branch
    expect(session.future).toEqual([]);
    expect(session.undoneActions).toEqual([]);
  });

  it('is a no-op when game is over', () => {
    const overState: SinglesState = {
      type: 'singles',
      config: { pointsToWin: 11, winByPoints: 2 },
      players: [p1, p2],
      scores: [11, 9],
      servingPlayerIndex: 0,
      isGameOver: true,
    };
    const session = createSession(overState);
    const after = applyAction(session, 'serverScores');
    expect(after).toBe(session); // same reference — no change
  });
});

// ── Session: undo ──────────────────────────────────────────────────────────────

describe('undo', () => {
  it('restores the previous state', () => {
    const initial = createSinglesGame(p1, p2);
    let session = createSession(initial);
    session = applyAction(session, 'serverScores');
    session = undo(session);
    expect(session.present).toBe(initial);
  });

  it('moves present to future', () => {
    const session = createSession(createSinglesGame(p1, p2));
    const afterScore = applyAction(session, 'serverScores');
    const afterUndo = undo(afterScore);
    expect(afterUndo.future[0]).toBe(afterScore.present);
  });

  it('moves action to undoneActions', () => {
    let session = createSession(createSinglesGame(p1, p2));
    session = applyAction(session, 'serverScores');
    session = undo(session);
    expect(session.actions).toEqual([]);
    expect(session.undoneActions).toEqual(['serverScores']);
  });

  it('is a no-op when there is nothing to undo', () => {
    const session = createSession(createSinglesGame(p1, p2));
    expect(undo(session)).toBe(session);
  });

  it('can undo multiple steps', () => {
    const initial = createSinglesGame(p1, p2);
    let session = createSession(initial);
    session = applyAction(session, 'serverScores');
    session = applyAction(session, 'serverScores');
    session = undo(session);
    session = undo(session);
    expect(session.present).toBe(initial);
    expect(session.past).toEqual([]);
  });
});

// ── setManualState ─────────────────────────────────────────────────────────────

describe('setManualState', () => {
  describe('singles', () => {
    it('sets scores and serving player', () => {
      const state = setManualState(createSinglesGame(p1, p2), [7, 4], 1);
      expect(state.scores).toEqual([7, 4]);
      expect(state.servingPlayerIndex).toBe(1);
      expect(getServer(state)).toEqual(p2);
    });

    it('recomputes isGameOver when score meets win condition', () => {
      const state = setManualState(createSinglesGame(p1, p2), [11, 8], 0);
      expect(state.isGameOver).toBe(true);
    });

    it('isGameOver false when margin is insufficient', () => {
      const state = setManualState(createSinglesGame(p1, p2), [11, 10], 0);
      expect(state.isGameOver).toBe(false);
    });

    it('preserves players and config', () => {
      const original = createSinglesGame(p1, p2, { pointsToWin: 15 });
      const state = setManualState(original, [3, 5], 0);
      expect(state.players).toEqual([p1, p2]);
      expect(state.config.pointsToWin).toBe(15);
    });
  });

  describe('doubles', () => {
    it('sets scores and serving team', () => {
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [5, 3],
        0,
        false
      );
      expect(state.scores).toEqual([5, 3]);
      expect(state.servingTeamIndex).toBe(0);
      expect(state.isSecondServer).toBe(false);
    });

    it('derives court positions from score parity (odd score flips from start)', () => {
      // team0 score=5 (odd) → p1 on odd, p2 on even; team1 score=3 (odd) → p3 on odd, p4 on even
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [5, 3],
        0,
        false
      );
      expect(getPlayerSide(state, p1)).toBe('odd');
      expect(getPlayerSide(state, p2)).toBe('even');
      expect(getPlayerSide(state, p3)).toBe('odd');
      expect(getPlayerSide(state, p4)).toBe('even');
    });

    it('derives court positions from score parity (even score = starting sides)', () => {
      // team0 score=4 (even) → p1 on even, p2 on odd; team1 score=6 (even) → p3 on even, p4 on odd
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [4, 6],
        1,
        false
      );
      expect(getPlayerSide(state, p1)).toBe('even');
      expect(getPlayerSide(state, p2)).toBe('odd');
      expect(getPlayerSide(state, p3)).toBe('even');
      expect(getPlayerSide(state, p4)).toBe('odd');
    });

    it('sets currentServerId to server 1 (score-parity side) when isSecondServer=false', () => {
      // team0 score=5 (odd) → server1Side='odd' → p1 is on odd → p1 is server 1
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [5, 3],
        0,
        false
      );
      expect(getServer(state)).toEqual(p1);
    });

    it('sets currentServerId to server 2 (non-parity side) when isSecondServer=true', () => {
      // team0 score=5 (odd) → server1Side='odd' → p1 on odd → p2 (on even) is server 2
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [5, 3],
        0,
        true
      );
      expect(getServer(state)).toEqual(p2);
    });

    it('sets currentServerId correctly for team1 serving with even score', () => {
      // team1 score=6 (even) → server1Side='even' → p3 on even → p3 is server 1
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [4, 6],
        1,
        false
      );
      expect(getServer(state)).toEqual(p3);
    });

    it('recomputes isGameOver', () => {
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [11, 7],
        0,
        false
      );
      expect(state.isGameOver).toBe(true);
    });

    it('result is consistent with normal play for the same score', () => {
      // Manually set to a reachable game state and confirm announced score matches
      const state = setManualState(
        createDoublesGame([p1, p2], [p3, p4]),
        [3, 2],
        0,
        true
      );
      expect(getScoreAnnouncement(state)).toBe('3-2-2');
    });

    it('preserves teams and config', () => {
      const original = createDoublesGame([p1, p2], [p3, p4], {
        pointsToWin: 21,
      });
      const state = setManualState(original, [10, 5], 0, false);
      expect(state.teams[0].players).toEqual([p1, p2]);
      expect(state.teams[1].players).toEqual([p3, p4]);
      expect(state.config.pointsToWin).toBe(21);
    });
  });
});

// ── Session: redo ──────────────────────────────────────────────────────────────

describe('redo', () => {
  it('restores the undone state', () => {
    let session = createSession(createSinglesGame(p1, p2));
    session = applyAction(session, 'serverScores');
    const afterScore = session;
    session = undo(session);
    session = redo(session);
    expect(session.present).toBe(afterScore.present);
  });

  it('restores action to the log', () => {
    let session = createSession(createSinglesGame(p1, p2));
    session = applyAction(session, 'serverScores');
    session = undo(session);
    session = redo(session);
    expect(session.actions).toEqual(['serverScores']);
    expect(session.undoneActions).toEqual([]);
  });

  it('is a no-op when there is nothing to redo', () => {
    const session = createSession(createSinglesGame(p1, p2));
    expect(redo(session)).toBe(session);
  });

  it('can redo multiple steps', () => {
    let session = createSession(createSinglesGame(p1, p2));
    session = applyAction(session, 'serverScores');
    session = applyAction(session, 'serverLoses');
    const afterBoth = session;
    session = undo(session);
    session = undo(session);
    session = redo(session);
    session = redo(session);
    expect(session.present).toBe(afterBoth.present);
    expect(session.actions).toEqual(['serverScores', 'serverLoses']);
  });
});
