import React from "react";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import AnalyticsDashboard from "./AnalyticsDashboard.jsx";

export default function ViewerAnalytics() {
  return (
    <DashboardLayout>
      <AnalyticsDashboard role="viewer" />
    </DashboardLayout>
  );
}
