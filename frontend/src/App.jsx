import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Auth-panel/Login.jsx";
import Register from "./pages/Auth-panel/Register.jsx";
import DirectorHome from "./pages/Director-panel/DirectorHome.jsx";
import RequireRole from "./components/RequireRole.jsx";
import WatchVideo from "./pages/Helpers/WatchVideo.jsx";
import UploadVideo from "./pages/Director-panel/UploadVideo.jsx";
import EditVideo from "./pages/Director-panel/EditVideo.jsx";
import ViewerHome from "./pages/Viewer-panel/ViewerHome.jsx";
import ViewerWatchVideo from "./pages/Viewer-panel/ViewerWatchVideo.jsx";
import ViewerHistory from "./pages/Viewer-panel/ViewerHistory.jsx";
import ViewerWatchlist from "./pages/Viewer-panel/ViewerWatchlist.jsx";
import ViewerProfile from "./pages/Viewer-panel/ViewerProfile.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/director" element={<RequireRole roles={["director"]}><DirectorHome /></RequireRole>} />
      <Route path="/director/upload" element={<RequireRole roles={["director"]}><UploadVideo /></RequireRole>} />
      <Route path="/director/videos/:id/watch" element={<RequireRole roles={["director"]}><WatchVideo /></RequireRole>} />
      <Route path="/director/videos/:id/edit" element={<RequireRole roles={["director"]}><EditVideo /></RequireRole>} />

      <Route path="/viewer" element={<RequireRole roles={["viewer"]}><ViewerHome /></RequireRole>} />
      <Route path="/viewer/videos/:id" element={<RequireRole roles={["viewer"]}><ViewerWatchVideo /></RequireRole>} />
      <Route path="/viewer/history" element={<RequireRole roles={["viewer"]}><ViewerHistory /></RequireRole>} />
      <Route path="/viewer/watchlist" element={<RequireRole roles={["viewer"]}><ViewerWatchlist /></RequireRole>} />
      <Route path="/viewer/profile" element={<RequireRole roles={["viewer"]}><ViewerProfile /></RequireRole>} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
