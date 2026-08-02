import React from "react";
import { VOTE_SECONDS } from "../lib/gameData";

export function CharCard({ entry, side, className = "", onClick }) {
  return (
    <div className={`char-card side-${side} ${className}`} onClick={onClick}>
      {entry.i ? (
        <img
          className="char-avatar-img"
          src={entry.i}
          alt={entry.n}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
      ) : null}
      <div className="char-avatar" style={{ display: entry.i ? "none" : "flex" }}>
        {entry.n.charAt(0)}
      </div>
      <div className="char-name">{entry.n}</div>
      <div className="char-series">{entry.s.toUpperCase()}</div>
    </div>
  );
}

export function TimerRing({ secondsLeft, total = VOTE_SECONDS }) {
  const pct = Math.max(0, Math.min(1, secondsLeft / total));
  const deg = pct * 360;
  return (
    <div className="timer-wrap">
      <div
        className="timer-ring"
        style={{ background: `conic-gradient(var(--cyan) 0deg ${deg}deg, #3A2C6E ${deg}deg 360deg)` }}
      >
        <div className="timer-num">{Math.max(0, secondsLeft)}</div>
      </div>
    </div>
  );
}

export function Scoreboard({ teacherScore, studentScore }) {
  return (
    <div className="scoreboard">
      <div className="score-half you">
        <div className="score-label">Teacher</div>
        <div className="score-num">{teacherScore}</div>
      </div>
      <div className="score-half class">
        <div className="score-label">Class</div>
        <div className="score-num">{studentScore}</div>
      </div>
    </div>
  );
}
