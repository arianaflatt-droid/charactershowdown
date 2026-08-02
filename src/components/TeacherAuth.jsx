import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function friendlyAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account — try logging in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with that email — try signing up instead.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function TeacherAuth({ onBack, onLoggedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      let cred;
      if (mode === "signup") {
        cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      const uid = cred.user.uid;
      const profileRef = doc(db, "teachers", uid);
      const snap = await getDoc(profileRef);
      let profile;
      if (!snap.exists()) {
        profile = {
          uid,
          email: email.trim(),
          totalTeacherPoints: 0,
          totalStudentPoints: 0,
          gamesPlayed: 0,
          history: [],
          disabledSeries: [],
        };
        await setDoc(profileRef, profile);
      } else {
        profile = snap.data();
      }
      onLoggedIn(profile);
    } catch (e) {
      setError(friendlyAuthError(e.code));
    }
    setLoading(false);
  };

  return (
    <div className="mcg-wrap">
      <button className="mcg-back" onClick={onBack}>← Back</button>
      <div className="mcg-eyebrow">Teacher</div>
      <h1 className="mcg-h1">{mode === "signup" ? "Create your account" : "Log in"}</h1>
      <div className="mcg-card">
        {error && <div className="mcg-error">{error}</div>}
        <input
          className="mcg-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="mcg-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="mcg-btn mcg-btn-primary" disabled={!email.trim() || !password || loading} onClick={submit}>
          {loading ? "Please wait…" : mode === "signup" ? "Sign Up" : "Log In"}
        </button>
        <button
          className="mcg-btn mcg-btn-ghost"
          style={{ display: "block", margin: "12px auto 0", textAlign: "center" }}
          onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}
        >
          {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
