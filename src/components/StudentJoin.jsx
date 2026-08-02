import React, { useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function StudentJoin({ onBack, onJoined }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    const upperCode = code.trim().toUpperCase();
    try {
      const roomRef = doc(db, "rooms", upperCode);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setBusy(false);
        setError("No game found with that code — check with your teacher.");
        return;
      }
      // Sign in anonymously so Firestore security rules have something to check against.
      const cred = auth.currentUser || (await signInAnonymously(auth)).user;
      const studentId = cred.uid || auth.currentUser.uid;
      await updateDoc(roomRef, { students: arrayUnion(studentId) });
      setBusy(false);
      onJoined(upperCode, studentId);
    } catch (e) {
      setBusy(false);
      setError("Couldn't join — check your connection and try again.");
    }
  };

  return (
    <div className="mcg-wrap">
      <button className="mcg-back" onClick={onBack}>← Back</button>
      <div className="mcg-eyebrow">Student</div>
      <h1 className="mcg-h1">Join a game</h1>
      <div className="mcg-card">
        {error && <div className="mcg-error">{error}</div>}
        <input className="mcg-input" placeholder="ROOM CODE" value={code} maxLength={4}
          onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && join()} />
        <button className="mcg-btn mcg-btn-primary" disabled={busy || !code.trim()} onClick={join}>{busy ? "Joining…" : "Join"}</button>
      </div>
    </div>
  );
}
