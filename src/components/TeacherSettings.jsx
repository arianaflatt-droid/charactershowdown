import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getSeriesByCategory } from "../lib/gameData";

const SERIES_BY_CATEGORY = getSeriesByCategory();
const CATEGORY_LIST = Object.keys(SERIES_BY_CATEGORY);

export default function TeacherSettings({ profile, onBack, onProfileUpdate }) {
  const [disabled, setDisabled] = useState(new Set(profile.disabledSeries || []));
  const [openCategory, setOpenCategory] = useState(CATEGORY_LIST[0]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSeries = (series) => {
    setSaved(false);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  };

  const setAllInCategory = (category, enable) => {
    setSaved(false);
    setDisabled((prev) => {
      const next = new Set(prev);
      SERIES_BY_CATEGORY[category].forEach((s) => {
        if (enable) next.delete(s);
        else next.add(s);
      });
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    const newProfile = { ...profile, disabledSeries: Array.from(disabled) };
    try {
      await setDoc(doc(db, "teachers", profile.uid), newProfile);
      onProfileUpdate(newProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      // no-op — button stays enabled so they can retry
    }
    setBusy(false);
  };

  return (
    <div className="mcg-wrap">
      <button className="mcg-back" onClick={onBack}>← Back</button>
      <div className="mcg-eyebrow">Teacher</div>
      <h1 className="mcg-h1">Movie & Show Settings</h1>
      <p className="mcg-muted" style={{ textAlign: "center", marginBottom: 20 }}>
        Turn off any movie, show, or game you don't know well enough to guess characters from.
        Turned-off titles are skipped when the game picks characters.
      </p>

      <div className="mcg-card">
        {CATEGORY_LIST.map((category) => {
          const seriesList = SERIES_BY_CATEGORY[category];
          const isOpen = openCategory === category;
          const enabledCount = seriesList.filter((s) => !disabled.has(s)).length;
          return (
            <div key={category} style={{ marginBottom: 10, borderBottom: "1px solid #3A2C6E", paddingBottom: 10 }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setOpenCategory(isOpen ? null : category)}
              >
                <span style={{ fontWeight: 700 }}>{category}</span>
                <span className="mcg-muted">{enabledCount}/{seriesList.length} on {isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: 10 }}>
                  <div className="mcg-row" style={{ marginBottom: 10 }}>
                    <button className="mcg-btn mcg-btn-secondary" style={{ fontSize: 12, padding: "8px 10px" }} onClick={() => setAllInCategory(category, true)}>Turn all on</button>
                    <button className="mcg-btn mcg-btn-secondary" style={{ fontSize: 12, padding: "8px 10px" }} onClick={() => setAllInCategory(category, false)}>Turn all off</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                    {seriesList.map((series) => (
                      <label key={series} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={!disabled.has(series)} onChange={() => toggleSeries(series)} />
                        <span style={{ opacity: disabled.has(series) ? 0.45 : 1 }}>{series}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="mcg-btn mcg-btn-primary" disabled={busy} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
