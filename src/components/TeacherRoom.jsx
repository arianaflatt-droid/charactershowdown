import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  doc, onSnapshot, runTransaction, updateDoc, collection, query, where, getDocs, getDoc, setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { CharCard, TimerRing, Scoreboard } from "./Shared";
import { getAvailableCategories, pickPair, tallyVotes, matchesGuess, VOTE_SECONDS, GUESS_SECONDS } from "../lib/gameData";

export default function TeacherRoom({ code, profile, onBack, onProfileUpdate }) {
  const [room, setRoom] = useState(null);
  const [voteDocs, setVoteDocs] = useState([]);
  const [category, setCategory] = useState("");
  const [guessText, setGuessText] = useState("");
  const [guessFeedback, setGuessFeedback] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const tickRef = useRef(null);
  const finalizingRef = useRef(false);
  const autoSubmitForRoundRef = useRef(null);
  const cr = room ? room.currentRound : null;

  // Listen to the room doc in realtime
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rooms", code), (snap) => {
      if (snap.exists()) setRoom(snap.data());
    });
    tickRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => { unsub(); clearInterval(tickRef.current); };
  }, [code]);

  // Listen to votes for the current round only
  useEffect(() => {
    if (!room || !room.currentRound) { setVoteDocs([]); return; }
    const startedAt = room.currentRound.startedAt;
    const votesQuery = query(collection(db, "rooms", code, "votes"), where("roundStartedAt", "==", startedAt));
    const unsub = onSnapshot(votesQuery, (snap) => {
      setVoteDocs(snap.docs.map((d) => d.data()));
    });
    return () => unsub();
  }, [code, room?.currentRound?.startedAt]);

  const copyCode = () => {
    const fallbackCopy = () => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (e) {
        setError("Couldn't copy — try selecting and copying the code manually.");
        setTimeout(() => setError(""), 2500);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  // Finalize the winner once time is up OR everyone who joined has voted
  useEffect(() => {
    if (!room || !room.currentRound || room.currentRound.finished) return;
    const cr = room.currentRound;
    if (cr.winnerSide) return;
    const totalStudents = (room.students || []).length;
    const allVoted = totalStudents > 0 && voteDocs.length >= totalStudents;
    const timeUp = now >= cr.votingEndsAt;
    if (!timeUp && !allVoted) return;
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    (async () => {
      try {
        await runTransaction(db, async (tx) => {
          const roomRef = doc(db, "rooms", code);
          const roomSnap = await tx.get(roomRef);
          const roomData = roomSnap.data();
          const cr2 = roomData.currentRound;
          if (!cr2 || cr2.startedAt !== cr.startedAt || cr2.winnerSide) return;

          // Re-tally inside the transaction window using the votes we already have client-side;
          // good enough for classroom scale (small vote counts, low write contention).
          const tally = tallyVotes(voteDocs);
          let winnerSide;
          if (tally.a > tally.b) winnerSide = "a";
          else if (tally.b > tally.a) winnerSide = "b";
          else winnerSide = Math.random() < 0.5 ? "a" : "b";

          tx.update(roomRef, {
            "currentRound.winnerSide": winnerSide,
            "currentRound.votingEndsAt": Math.min(cr2.votingEndsAt, Date.now()),
            "currentRound.guessDeadline": Date.now() + GUESS_SECONDS * 1000,
          });
        });
      } finally {
        finalizingRef.current = false;
      }
    })();
  }, [room, now, code, voteDocs]);

  // Auto-submit whatever guess (or blank) is entered once the 2-minute question timer runs out.
  // submitGuess is defined further below, but by the time this effect actually fires (after
  // render commits), it will already be assigned for any render where `cr` is truthy.
  useEffect(() => {
    if (!cr || cr.finished || !cr.winnerSide || !cr.guessDeadline) return;
    if (now < cr.guessDeadline) return;
    if (autoSubmitForRoundRef.current === cr.startedAt) return;
    autoSubmitForRoundRef.current = cr.startedAt;
    submitGuess(true);
  }, [cr, now]);

  if (!room) return <div className="mcg-wrap"><div className="mcg-loading">Loading room…</div></div>;

  const availableCategories = getAvailableCategories(room.usedKeys, profile.disabledSeries);

  const startRound = async () => {
    if (!category) return;
    setError("");
    const pair = pickPair(category, room.usedKeys, profile.disabledSeries);
    if (!pair) { setError("Not enough unused characters left in that category."); return; }
    setBusy(true);
    const newRound = {
      category, startedAt: Date.now(), votingEndsAt: Date.now() + VOTE_SECONDS * 1000,
      charA: pair.charA, charB: pair.charB, winnerSide: null, guessDeadline: null, hintRequestedAt: null,
      guessText: null, guessCorrect: null, finished: false,
    };
    try {
      await updateDoc(doc(db, "rooms", code), { currentRound: newRound });
      setGuessText("");
      setGuessFeedback("");
    } catch (e) {
      setError("Couldn't start the round — try again.");
    }
    setBusy(false);
  };

  const submitGuess = async (force = false) => {
    if (!cr || !cr.winnerSide) return;
    if (!force && !guessText.trim()) return;
    const winnerEntry = cr.winnerSide === "a" ? cr.charA : cr.charB;
    const correct = matchesGuess(guessText, winnerEntry);

    // Wrong guess, but time hasn't run out yet: let them try again, no penalty, round stays open.
    if (!correct && !force) {
      setGuessFeedback("❌ Not quite — try again!");
      setGuessText("");
      return;
    }

    setBusy(true);
    setGuessFeedback("");
    try {
      await updateDoc(doc(db, "rooms", code), {
        scoreTeacher: room.scoreTeacher + (correct ? 1 : 0),
        scoreStudents: room.scoreStudents + (correct ? 0 : 1),
        usedKeys: [...room.usedKeys, cr.charA.key, cr.charB.key],
        "currentRound.guessText": guessText.trim() || "(no correct guess — time ran out)",
        "currentRound.guessCorrect": correct,
        "currentRound.finished": true,
        roundHistory: [...room.roundHistory, { category: cr.category, winnerName: winnerEntry.n, guess: guessText.trim(), correct }],
      });
      // Bank the point into the teacher's persistent profile right away.
      const profileRef = doc(db, "teachers", profile.uid);
      const freshSnap = await getDoc(profileRef);
      const freshProfile = freshSnap.exists() ? freshSnap.data() : profile;
      const newProfile = {
        ...freshProfile,
        totalTeacherPoints: freshProfile.totalTeacherPoints + (correct ? 1 : 0),
        totalStudentPoints: freshProfile.totalStudentPoints + (correct ? 0 : 1),
      };
      await setDoc(profileRef, newProfile);
      onProfileUpdate(newProfile);
    } catch (e) {
      setError("Couldn't submit the guess — try again.");
    }
    setBusy(false);
  };

  const concedeRound = async () => {
    if (!cr || !cr.winnerSide || cr.finished) return;
    const confirmed = window.confirm("Give up on this round? The class will get the point.");
    if (!confirmed) return;
    const winnerEntry = cr.winnerSide === "a" ? cr.charA : cr.charB;
    setBusy(true);
    setGuessFeedback("");
    try {
      await updateDoc(doc(db, "rooms", code), {
        scoreStudents: room.scoreStudents + 1,
        usedKeys: [...room.usedKeys, cr.charA.key, cr.charB.key],
        "currentRound.guessText": "(teacher conceded)",
        "currentRound.guessCorrect": false,
        "currentRound.finished": true,
        roundHistory: [...room.roundHistory, { category: cr.category, winnerName: winnerEntry.n, guess: "(conceded)", correct: false }],
      });
      // Bank the point into the teacher's persistent profile right away.
      const profileRef = doc(db, "teachers", profile.uid);
      const freshSnap = await getDoc(profileRef);
      const freshProfile = freshSnap.exists() ? freshSnap.data() : profile;
      const newProfile = { ...freshProfile, totalStudentPoints: freshProfile.totalStudentPoints + 1 };
      await setDoc(profileRef, newProfile);
      onProfileUpdate(newProfile);
    } catch (e) {
      setError("Couldn't concede the round — try again.");
    }
    setBusy(false);
  };

  const nextRound = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "rooms", code), { currentRound: null });
      setCategory("");
      setGuessText("");
    } catch (e) {
      setError("Couldn't start the next round — try again.");
    }
    setBusy(false);
  };

  const endGame = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "rooms", code), { status: "ended" });
      const profileRef = doc(db, "teachers", profile.uid);
      const freshSnap = await getDoc(profileRef);
      const freshProfile = freshSnap.exists() ? freshSnap.data() : profile;
      const newProfile = {
        ...freshProfile,
        gamesPlayed: freshProfile.gamesPlayed + 1,
        history: [...(freshProfile.history || []), { code, date: Date.now(), teacherScore: room.scoreTeacher, studentScore: room.scoreStudents }],
      };
      await setDoc(profileRef, newProfile);
      onProfileUpdate(newProfile);
      onBack();
    } catch (e) {
      setError("Couldn't end the game — try again.");
    }
    setBusy(false);
  };

  const askForHint = async () => {
    try {
      await updateDoc(doc(db, "rooms", code), { "currentRound.hintRequestedAt": Date.now() });
    } catch (e) {
      // no-op — not critical if this fails, teacher can just tap it again
    }
  };

  const secondsLeft = cr ? Math.ceil((cr.votingEndsAt - now) / 1000) : 0;
  const votingOpen = cr && !cr.finished && !cr.winnerSide && secondsLeft > 0;
  const awaitingGuess = cr && !cr.finished && cr.winnerSide;
  const guessSecondsLeft = cr && cr.guessDeadline ? Math.ceil((cr.guessDeadline - now) / 1000) : GUESS_SECONDS;
  const guessElapsed = GUESS_SECONDS - guessSecondsLeft;
  const hintAvailable = guessElapsed >= 60;
  const hintWaitRemaining = Math.max(0, 60 - guessElapsed);

  return (
    <div className="mcg-wrap">
      <button className="mcg-back" onClick={onBack}>← Leave room (game stays open)</button>
      <div className="mcg-eyebrow">Room Code · Tap to Copy</div>
      <div className="mcg-code mcg-code-clickable" onClick={copyCode}>{copied ? "Copied!" : code}</div>
      <Scoreboard teacherScore={room.scoreTeacher} studentScore={room.scoreStudents} />
      {error && <div className="mcg-error">{error}</div>}

      {!cr && (
        <div className="mcg-card">
          <h2 className="mcg-h2">Start a round</h2>
          {availableCategories.length === 0 ? (
            <p className="mcg-muted">No categories with enough unused characters left.</p>
          ) : (
            <>
              <select className="mcg-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Choose a category…</option>
                {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="mcg-btn mcg-btn-primary" disabled={!category || busy} onClick={startRound}>Start Round</button>
            </>
          )}
        </div>
      )}

      {votingOpen && (
        <div className="blind-panel">
          <div className="blind-icon">🙈</div>
          <TimerRing secondsLeft={secondsLeft} />
          <p className="hint" style={{ marginTop: 14 }}>Your class is voting right now — no peeking! You'll get to guess once time's up.</p>
        </div>
      )}

      {awaitingGuess && !cr.finished && (
        <div className="panel" style={{ textAlign: "center" }}>
          <div className="blind-icon">✍️</div>
          <h2 className="mcg-h2" style={{ textAlign: "center" }}>Votes are locked in!</h2>
          <p className="hint" style={{ marginBottom: 10 }}>Guess as many times as you want — you only lose if you don't get it before time's up.</p>
          <TimerRing secondsLeft={guessSecondsLeft} total={GUESS_SECONDS} />
          <p className="hint" style={{ marginBottom: 14 }}>Time left for questions and guesses</p>
          <button className="mcg-btn mcg-btn-secondary" style={{ marginBottom: 14 }} disabled={!hintAvailable} onClick={askForHint}>
            {hintAvailable ? "🖐️ Ask Class for a Hint" : `🖐️ Hint available in ${hintWaitRemaining}s`}
          </button>
          {guessFeedback && <div className="mcg-error" style={{ background: "rgba(255,201,77,0.15)", borderColor: "var(--gold)", color: "var(--gold)" }}>{guessFeedback}</div>}
          <input className="guess-input" placeholder="Type the character's name…" value={guessText}
            onChange={(e) => setGuessText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitGuess()} />
          <button className="submit-btn" disabled={!guessText.trim() || busy} onClick={() => submitGuess()}>Submit Guess</button>
          <button className="mcg-btn mcg-btn-secondary" style={{ marginTop: 10 }} disabled={busy} onClick={concedeRound}>
            🏳️ Concede Round (class scores)
          </button>
        </div>
      )}

      {cr && cr.finished && (
        <div>
          <div className={`result-banner ${cr.guessCorrect ? "good" : "bad"}`}>
            <div className="result-icon">{cr.guessCorrect ? "✔" : "✘"}</div>
            <div>{cr.guessCorrect ? "Correct! You scored a point." : "Incorrect — the class scores a point."}</div>
          </div>
          <div className="single-card-wrap">
            <CharCard entry={cr.winnerSide === "a" ? cr.charA : cr.charB} side={cr.winnerSide} className="solo winner" />
          </div>
          <div className="panel">
            <div className="big-score">
              <div className="big-score-half you"><div className="big-score-label">You</div><div className="big-score-num">{room.scoreTeacher}</div></div>
              <div className="big-score-plus">{cr.guessCorrect ? "+1" : ""}</div>
              <div className="big-score-half class"><div className="big-score-label">Class</div><div className="big-score-num">{room.scoreStudents}</div></div>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              {cr.guessText === "(teacher conceded)" ? "You conceded this round." : `Your guess: "${cr.guessText}"`}
            </p>
          </div>
          <button className="mcg-btn mcg-btn-primary" style={{ marginBottom: 10 }} disabled={busy} onClick={nextRound}>Next Round</button>
        </div>
      )}

      <button className="mcg-btn mcg-btn-secondary" disabled={busy} onClick={endGame}>End Game & Save Score</button>
    </div>
  );
}
