import React from "react";

export default function Home({ onPick }) {
  return (
    <div className="mcg-wrap">
      <div className="mcg-eyebrow">Classroom Guessing Game</div>
      <h1 className="mcg-h1">Character Showdown</h1>
      <p className="mcg-muted" style={{ textAlign: "center", marginBottom: 24 }}>
        Two characters face off. Students vote for their favorite — the teacher guesses who won
        without seeing a thing.
      </p>
      <div className="mcg-card">
        <button className="mcg-btn mcg-btn-primary" style={{ marginBottom: 10 }} onClick={() => onPick("teacher")}>
          I'm the Teacher
        </button>
        <button className="mcg-btn mcg-btn-secondary" onClick={() => onPick("student")}>
          I'm a Student
        </button>
      </div>
    </div>
  );
}
