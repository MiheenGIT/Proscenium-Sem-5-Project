import React from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import RequireRole from "./components/RequireRole.jsx";

import Login from "./pages/Auth-panel/Login.jsx";
import Register from "./pages/Auth-panel/Register.jsx";

import DirectorHome from "./pages/Director-panel/DirectorHome.jsx";
import EditVideo from "./pages/Director-panel/EditVideo.jsx";
import UploadVideo from "./pages/Director-panel/UploadVideo.jsx";
import DirectorWatchVideo from "./pages/Helpers/WatchVideo.jsx";

import Dashboard from "./pages/Viewer-panel/Dashboard.jsx";
import History from "./pages/Viewer-panel/History.jsx";
import LibraryPage from "./pages/Viewer-panel/LibraryPage.jsx";
import MovieDetail from "./pages/Viewer-panel/MovieDetail.jsx";
import Profile from "./pages/Viewer-panel/Profile.jsx";
import Reviews from "./pages/Viewer-panel/Reviews.jsx";
import WatchVideo from "./pages/Viewer-panel/WatchVideo.jsx";
import AccountPages from "./pages/Viewer-panel/AccountPages.jsx";

import AdminLayout from "./layouts/AdminLayout.jsx";
import AdminDashboard from "./pages/Admin-panel/Dashboard.jsx";
import AdminContent from "./pages/Admin-panel/Content.jsx";
import AdminReview from "./pages/Admin-panel/Review.jsx";
import AdminComments from "./pages/Admin-panel/Comments.jsx";

function ViewerOnly({ children }) {
  return (
    <RequireRole roles={["viewer"]}>
      {children}
    </RequireRole>
  );
}

function DirectorOnly({ children }) {
  return (
    <RequireRole roles={["director"]}>
      {children}
    </RequireRole>
  );
}

function AdminOnly({ children }) {
  return (
    <RequireRole roles={["admin"]}>
      <AdminLayout>
        {children}
      </AdminLayout>
    </RequireRole>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      {/* ================= ADMIN ================= */}

      <Route
        path="/admin"
        element={
          <AdminOnly>
            <AdminDashboard />
          </AdminOnly>
        }
      />

      <Route
        path="/admin/content"
        element={
          <AdminOnly>
            <AdminContent />
          </AdminOnly>
        }
      />

      <Route
        path="/admin/review"
        element={
          <AdminOnly>
            <AdminReview />
          </AdminOnly>
        }
      />

      <Route
        path="/admin/comments"
        element={
          <AdminOnly>
            <AdminComments />
          </AdminOnly>
        }
      />

      {/* ================= DIRECTOR ================= */}

      <Route
        path="/director"
        element={
          <DirectorOnly>
            <DirectorHome />
          </DirectorOnly>
        }
      />

      <Route
        path="/director/upload"
        element={
          <DirectorOnly>
            <UploadVideo />
          </DirectorOnly>
        }
      />

      <Route
        path="/director/videos/:id/watch"
        element={
          <DirectorOnly>
            <DirectorWatchVideo />
          </DirectorOnly>
        }
      />

      <Route
        path="/director/videos/:id/edit"
        element={
          <DirectorOnly>
            <EditVideo />
          </DirectorOnly>
        }
      />

      {/* ================= VIEWER ================= */}

      <Route
        path="/"
        element={
          <Navigate
            to="/viewer"
            replace
          />
        }
      />

      <Route
        path="/viewer"
        element={
          <ViewerOnly>
            <Dashboard />
          </ViewerOnly>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ViewerOnly>
            <Dashboard />
          </ViewerOnly>
        }
      />

      <Route
        path="/viewer/dashboard"
        element={
          <ViewerOnly>
            <Dashboard />
          </ViewerOnly>
        }
      />

      <Route
        path="/movie/:id"
        element={
          <ViewerOnly>
            <MovieDetail />
          </ViewerOnly>
        }
      />

      <Route
        path="/viewer/movie/:id"
        element={
          <ViewerOnly>
            <MovieDetail />
          </ViewerOnly>
        }
      />

      <Route
        path="/watch/:id"
        element={
          <ViewerOnly>
            <WatchVideo />
          </ViewerOnly>
        }
      />

      <Route
        path="/viewer/watch/:id"
        element={
          <ViewerOnly>
            <WatchVideo />
          </ViewerOnly>
        }
      />

      <Route
        path="/viewer/videos/:id"
        element={
          <ViewerOnly>
            <WatchVideo />
          </ViewerOnly>
        }
      />

      <Route
        path="/explore"
        element={
          <ViewerOnly>
            <LibraryPage mode="explore" />
          </ViewerOnly>
        }
      />

      <Route
        path="/trending"
        element={
          <ViewerOnly>
            <LibraryPage mode="trending" />
          </ViewerOnly>
        }
      />

      <Route
        path="/for-you"
        element={
          <ViewerOnly>
            <LibraryPage mode="for-you" />
          </ViewerOnly>
        }
      />

      <Route
        path="/watchlist"
        element={
          <ViewerOnly>
            <LibraryPage mode="watchlist" />
          </ViewerOnly>
        }
      />

      <Route
        path="/history"
        element={
          <ViewerOnly>
            <History />
          </ViewerOnly>
        }
      />

      <Route
        path="/liked"
        element={
          <ViewerOnly>
            <LibraryPage mode="liked" />
          </ViewerOnly>
        }
      />

      <Route
        path="/reviews"
        element={
          <ViewerOnly>
            <Reviews />
          </ViewerOnly>
        }
      />

      <Route
        path="/profile"
        element={
          <ViewerOnly>
            <Profile />
          </ViewerOnly>
        }
      />

      <Route
        path="/settings"
        element={
          <ViewerOnly>
            <AccountPages section="settings" />
          </ViewerOnly>
        }
      />

      <Route
        path="/notifications"
        element={
          <ViewerOnly>
            <AccountPages section="notifications" />
          </ViewerOnly>
        }
      />

      <Route
        path="/preferences/genres"
        element={
          <ViewerOnly>
            <AccountPages section="genres" />
          </ViewerOnly>
        }
      />

      <Route
        path="/preferences/languages"
        element={
          <ViewerOnly>
            <AccountPages section="languages" />
          </ViewerOnly>
        }
      />

      <Route
        path="/help"
        element={
          <ViewerOnly>
            <AccountPages section="help" />
          </ViewerOnly>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />
    </Routes>
  );
}