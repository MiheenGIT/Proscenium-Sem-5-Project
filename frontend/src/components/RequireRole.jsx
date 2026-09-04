import React from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireRole({
  roles,
  children,
}) {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth?.token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (
    Array.isArray(roles) &&
    roles.length &&
    !roles.includes(auth.role)
  ) {
    if (auth.role === "admin") {
      return (
        <Navigate
          to="/admin"
          replace
        />
      );
    }

    if (auth.role === "director") {
      return (
        <Navigate
          to="/director"
          replace
        />
      );
    }

    if (auth.role === "viewer") {
      return (
        <Navigate
          to="/viewer"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}