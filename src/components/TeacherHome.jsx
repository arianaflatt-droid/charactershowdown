import React, { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { generateCode } from "../lib/gameData";

export default function TeacherHome({ profile, onBack, onEnterRoom, onOpenSettings }) {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const createGame = async () => {
    setBusy(true);
    setError("");
    let code = generateCode();
    let tries = 0;
    let existing = await getDoc(doc(db, "rooms", code));
    while (existing.exists() && tries < 5) {
      code = generateCode();
      existing = await getDoc(doc(db, "rooms", code));
      tries++;
    }
    const room = {
      code,
      teacherUid: profile.uid,
      teacherEmail: profile.email,
      status: "active",
      createdAt: Date.now(),
      usedKeys: [],
      currentRound: null,
      scoreTeacher: 0,
      scoreStudents: 0,
      roundHistory: [],
      students: [],
    };
    try {
      await setDoc(doc(db, "rooms", code), room);
      onEnterRoom(code);
    } catch (e) {
      setError("Couldn't create the room. Try again.");
    }
    setBusy(false);
  };

  const rejoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError("");
    const code = joinCode.trim().toUpperCase();
    const snap = await getDoc(doc(db, "rooms", code));
    setBusy(false);
    if (!snap.exists()) {
      setError("No game found with that code.");
      return;
    }
    onEnterRoom(code);
  };

  const logout = async () => {
    await signOut(auth);
    onBack();
  };

  return (
    <div className="mcg-wrap">
      <button className="mcg-back" onClick={logout}>← Log out</button>
      <div className="mcg-eyebrow">Teacher</div>
      <h1 className="mcg-h1">Welcome back</h1>
      <p className="mcg-muted" style={{ textAlign: "center", marginTop: -12, marginBottom: 16 }}>{profile.email}</p>
      <div className="scoreboard">
        <div className="score-half you"><div className="score-label">Your points</div><div className="score-num">{profile.totalTeacherPoints}</div></div>
        <div className="score-half class"><div className="score-label">Student points</div><div className="score-num">{profile.totalStudentPoints}</div></div>
      </div>
      <p className="mcg-muted" style={{ textAlign: "center", marginTop: -6, marginBottom: 16 }}>
        {profile.gamesPlayed} game{profile.gamesPlayed === 1 ? "" : "s"} played this year
      </p>
      <div className="mcg-card">
        <h2 className="mcg-h2">Start a new game</h2>
        <p className="mcg-muted" style={{ marginBottom: 14 }}>You'll get a room code students can join from their own device.</p>
        <button className="mcg-btn mcg-btn-primary" disabled={busy} onClick={createGame}>{busy ? "Creating…" : "Create New Game"}</button>
      </div>
      <div className="mcg-card">
        <h2 className="mcg-h2">Movie & show settings</h2>
        <p className="mcg-muted" style={{ marginBottom: 14 }}>Turn off any titles you don't know well before you play.</p>
        <button className="mcg-btn mcg-btn-secondary" onClick={onOpenSettings}>Manage Settings</button>
      </div>
      <div className="mcg-card">
        <h2 className="mcg-h2">Resume a game</h2>
        {error && <div className="mcg-error">{error}</div>}
        <input className="mcg-input" placeholder="ROOM CODE" value={joinCode} maxLength={4}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
        <button className="mcg-btn mcg-btn-secondary" disabled={busy || !joinCode.trim()} onClick={rejoin}>Rejoin</button>
      </div>
      {profile.history && profile.history.length > 0 && (
        <div className="mcg-card">
          <h2 className="mcg-h2">Recent games</h2>
          {profile.history.slice(-6).reverse().map((h, i) => (
            <div className="mcg-list-row" key={i}>
              <span>{new Date(h.date).toLocaleDateString()} · {h.code}</span>
              <span>{h.teacherScore} – {h.studentScore}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
