import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Auth-panel/Login.jsx";
import Register from "./pages/Auth-panel/Register.jsx";
import DirectorHome from "./pages/Director-panel/DirectorHome.jsx";
import RequireRole from "./components/RequireRole.jsx";
import WatchVideo from "./pages/Helpers/WatchVideo.jsx";
import UploadVideo from "./pages/Director-panel/UploadVideo.jsx";
import EditVideo from "./pages/Director-panel/EditVideo.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/director"
        element={
          <RequireRole roles={["director"]}>
            <DirectorHome />
          </RequireRole>
        }
      />

      <Route
        path="/director/upload"
        element={
          <RequireRole roles={["director"]}>
            <UploadVideo />
          </RequireRole>
        }
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />

      <Route
        path="/director/videos/:id/watch"
        element={
          <RequireRole roles={["director"]}>
            <WatchVideo />
          </RequireRole>
        }
      />
      <Route
        path="/director/videos/:id/edit"
        element={
          <RequireRole roles={["director"]}>
            <EditVideo />
          </RequireRole>
        }
      />
    </Routes>
  );
}
