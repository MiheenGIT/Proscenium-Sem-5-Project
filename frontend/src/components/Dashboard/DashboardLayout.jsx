import React, { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#100d10] text-[#efe7da]">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed
            ? "lg:pl-[76px]"
            : "lg:pl-[240px]"
        }`}
      >
        <TopBar
          onMenu={() => setMobileOpen(true)}
        />

        {children}
      </div>
    </div>
  );
}