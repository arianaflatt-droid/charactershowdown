import React, { useState } from "react";
import Home from "./components/Home";
import TeacherAuth from "./components/TeacherAuth";
import TeacherHome from "./components/TeacherHome";
import TeacherSettings from "./components/TeacherSettings";
import TeacherRoom from "./components/TeacherRoom";
import StudentJoin from "./components/StudentJoin";
import StudentRoom from "./components/StudentRoom";

export default function App() {
  const [view, setView] = useState("home");
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [studentId, setStudentId] = useState(null);

  return (
    <div className="mcg">
      {view === "home" && (
        <Home onPick={(role) => setView(role === "teacher" ? "teacher-auth" : "student-join")} />
      )}

      {view === "teacher-auth" && (
        <TeacherAuth
          onBack={() => setView("home")}
          onLoggedIn={(p) => { setTeacherProfile(p); setView("teacher-home"); }}
        />
      )}

      {view === "teacher-home" && teacherProfile && (
        <TeacherHome
          profile={teacherProfile}
          onBack={() => { setTeacherProfile(null); setView("home"); }}
          onEnterRoom={(code) => { setRoomCode(code); setView("teacher-room"); }}
          onOpenSettings={() => setView("teacher-settings")}
        />
      )}

      {view === "teacher-settings" && teacherProfile && (
        <TeacherSettings
          profile={teacherProfile}
          onBack={() => setView("teacher-home")}
          onProfileUpdate={setTeacherProfile}
        />
      )}

      {view === "teacher-room" && teacherProfile && roomCode && (
        <TeacherRoom
          code={roomCode}
          profile={teacherProfile}
          onBack={() => setView("teacher-home")}
          onProfileUpdate={setTeacherProfile}
        />
      )}

      {view === "student-join" && (
        <StudentJoin
          onBack={() => setView("home")}
          onJoined={(code, id) => { setRoomCode(code); setStudentId(id); setView("student-room"); }}
        />
      )}

      {view === "student-room" && roomCode && studentId && (
        <StudentRoom
          code={roomCode}
          studentId={studentId}
          onBack={() => { setRoomCode(null); setStudentId(null); setView("home"); }}
        />
      )}
    </div>
  );
}
