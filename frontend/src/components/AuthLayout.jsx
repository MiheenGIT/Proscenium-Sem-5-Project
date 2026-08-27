import React from "react";
import "./AuthLayout.css";

/**
 * Split-screen shell shared by Login and Register.
 * Left: velvet brand panel. Right: the form, on a lighter "ticket" surface.
 * Between them: a perforated ticket-stub seam — the page's one signature
 * element — with punch-hole notches at top and bottom.
 */
export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <span className="auth-brand-mark">Proscenium</span>
          <p className="auth-brand-tagline">
            The house lights dim.
            <br />
            The reel begins.
          </p>
        </div>
        <div className="auth-brand-glow" aria-hidden="true" />
      </aside>

      <div className="auth-seam" aria-hidden="true">
        <span className="auth-seam-notch auth-seam-notch--top" />
        <span className="auth-seam-line" />
        <span className="auth-seam-notch auth-seam-notch--bottom" />
      </div>

      <main className="auth-form-panel">
        <div className="auth-form-inner">
          {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
