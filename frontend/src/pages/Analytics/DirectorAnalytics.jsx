import React from "react";
import DirectorNav from "../../components/DirectorNav.jsx";
import AnalyticsDashboard from "./AnalyticsDashboard.jsx";

export default function DirectorAnalytics() {
  return (
    <div className="analytics-role-shell">
      <DirectorNav />
      <main className="analytics-role-main">
        <AnalyticsDashboard role="director" />
      </main>
    </div>
  );
}
