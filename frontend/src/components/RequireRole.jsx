import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/** Redirects to /login unless the stored auth matches one of `roles`. */
export default function RequireRole({ roles, children }) {
  const { auth } = useAuth();

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(auth.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
