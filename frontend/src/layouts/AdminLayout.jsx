import React, {
  useState,
} from "react";
import Sidebar from "../components/admin/Sidebar.jsx";
import Topbar from "../components/admin/Topbar.jsx";

export default function AdminLayout({
  children,
}) {
  const [collapsed, setCollapsed] =
    useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

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
            ? "lg:pl-19"
            : "lg:pl-[240px]"
        }`}
      >
        <Topbar />

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}