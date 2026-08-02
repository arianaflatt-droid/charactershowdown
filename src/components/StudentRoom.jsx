import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CharCard, TimerRing, Scoreboard } from "./Shared";

export default function StudentRoom({ code, studentId, onBack }) {
  const [room, setRoom] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rooms", code), (snap) => {
      if (snap.exists()) setRoom(snap.data());
    });
    tickRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => { unsub(); clearInterval(tickRef.current); };
  }, [code]);

  // Reset my known vote whenever a new round starts
  useEffect(() => {
    setMyVote(null);
  }, [room?.currentRound?.startedAt]);

  // Listen to my own vote doc for this round (so it persists across refreshes)
  useEffect(() => {
    if (!room || !room.currentRound) return;
    const unsub = onSnapshot(doc(db, "rooms", code, "votes", `${room.currentRound.startedAt}_${studentId}`), (snap) => {
      if (snap.exists()) setMyVote(snap.data().side);
    });
    return () => unsub();
  }, [code, studentId, room?.currentRound?.startedAt]);

  if (!room) return <div className="mcg-wrap"><div className="mcg-loading">Loading room…</div></div>;

  const cr = room.currentRound;
  const secondsLeft = cr ? Math.ceil((cr.votingEndsAt - now) / 1000) : 0;
  const votingOpen = cr && !cr.finished && secondsLeft > 0;

  const vote = async (side) => {
    if (!votingOpen) return;
    setMyVote(side);
    try {
      await setDoc(doc(db, "rooms", code, "votes", `${cr.startedAt}_${studentId}`), {
        side,
        roundStartedAt: cr.startedAt,
        studentId,
      });
    } catch (e) {
      // If the write fails, the next snapshot will resync myVote to the true stored value.
    }
  };

  return (
    <div className="mcg-wrap">
      <button className="mcg-back" onClick={onBack}>← Leave</button>
      <div className="mcg-eyebrow">Room {code}</div>
      <h1 className="mcg-h1">Character Showdown</h1>

      {room.status === "ended" ? (
        <div className="mcg-card">
          <h2 className="mcg-h2">Game over</h2>
          <p>Final score — Teacher {room.scoreTeacher}, Students {room.scoreStudents}</p>
        </div>
      ) : (
        <>
          <Scoreboard teacherScore={room.scoreTeacher} studentScore={room.scoreStudents} />

          {!cr && (
            <div className="mcg-card" style={{ textAlign: "center" }}>
              <p className="hint">Waiting for the teacher to start a round…</p>
            </div>
          )}

          {votingOpen && (
            <div>
              <div className="category-tag">{cr.category}</div>
              <div className="battle">
                <div className="vs-badge">VS</div>
                <CharCard entry={cr.charA} side="a" className={myVote === "a" ? "selected" : ""} onClick={() => vote("a")} />
                <CharCard entry={cr.charB} side="b" className={myVote === "b" ? "selected" : ""} onClick={() => vote("b")} />
              </div>
              <TimerRing secondsLeft={secondsLeft} />
              <p className="hint">Tap a character to vote — you can change your mind until time's up</p>
            </div>
          )}

          {cr && !cr.finished && !votingOpen && (
            <div>
              {cr.hintRequestedAt && (
                <div className="panel" style={{ textAlign: "center", background: "rgba(255,201,77,0.18)", border: "2px solid var(--gold)" }}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>🖐️</div>
                  <div style={{ fontFamily: "'Bungee', cursive", fontSize: 18, color: "var(--gold)", lineHeight: 1.4 }}>
                    The teacher has asked for a hint!<br />Raise your hand to be called on.
                  </div>
                </div>
              )}
              <p className="hint" style={{ marginBottom: 10 }}>{myVote ? "You voted for:" : "You didn't vote in time!"}</p>
              {myVote && (
                <div className="single-card-wrap">
                  <CharCard entry={myVote === "a" ? cr.charA : cr.charB} side={myVote} className="solo" />
                </div>
              )}
              <div className="panel" style={{ textAlign: "center" }}>
                <p className="hint" style={{ marginBottom: 14 }}><strong style={{ color: "var(--text)" }}>Category:</strong> {cr.category}</p>
                <h2 className="mcg-h2" style={{ textAlign: "center", marginBottom: 4 }}><span className="pulse-dot"></span>Teacher is guessing…</h2>
                <p className="hint">Stay quiet so it's a fair guess!</p>
                <p className="hint" style={{ marginTop: 10 }}>💡 Your teacher may ask the class yes/no questions out loud to narrow it down — answer honestly as a group!</p>
              </div>
            </div>
          )}

          {cr && cr.finished && (
            <div>
              <div className={`result-banner ${cr.guessCorrect ? "bad" : "good"}`}>
                <div className="result-icon">{cr.guessCorrect ? "✘" : "✔"}</div>
                <div>{cr.guessCorrect ? "Teacher guessed right! Teacher +1" : "Teacher guessed wrong! Class +1"}</div>
              </div>
              <div className="single-card-wrap">
                <CharCard entry={cr.winnerSide === "a" ? cr.charA : cr.charB} side={cr.winnerSide} className="solo winner" />
              </div>
              <div className="panel">
                <div className="big-score">
                  <div className="big-score-half you"><div className="big-score-label">Teacher</div><div className="big-score-num">{room.scoreTeacher}</div></div>
                  <div className="big-score-half class"><div className="big-score-label">Class</div><div className="big-score-num">{room.scoreStudents}</div></div>
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  {myVote ? (myVote === cr.winnerSide ? "✔ You voted for the winner!" : "You voted for the other one.") : "You didn't vote this round."}
                </p>
                <p className="hint" style={{ margin: "2px 0 0" }}>Teacher guessed: "{cr.guessText}"</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
