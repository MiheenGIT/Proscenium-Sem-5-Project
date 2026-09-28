import React from "react";
import ViewerNav from "../ViewerNav.jsx";
import "./DashboardLayout.css";

export default function DashboardLayout({ children }) {
  return (
    <div className="viewer-shell">
      <ViewerNav />
      <main className="viewer-shell__main">{children}</main>
    </div>
  );
}
