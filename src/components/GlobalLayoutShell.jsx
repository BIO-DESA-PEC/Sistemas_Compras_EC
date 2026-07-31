// src/components/GlobalLayoutShell.jsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { usePathname } from "next/navigation";
import styles from "./globalLayoutShell.module.css";

export default function GlobalLayoutShell({ children, session, user }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(true);

    useEffect(() => {
      const mobileQuery = window.matchMedia("(max-width: 900px)");
      const syncSidebarWithViewport = (event) => setOpen(!event.matches);

      setOpen(!mobileQuery.matches);
      mobileQuery.addEventListener("change", syncSidebarWithViewport);

      return () => {
        mobileQuery.removeEventListener("change", syncSidebarWithViewport);
      };
    }, []);

    useEffect(() => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        setOpen(false);
      }
    }, [pathname]);

    useEffect(() => {
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      if (!isMobile || !open) return;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [open]);

    if (pathname === "/") {
        return <>{children}</>;
    }
  return (
    <div className={styles.theme}>
      {/* Botón hamburguesa SIEMPRE visible (desktop y mobile) */}
      <button
        className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Alternar menú"
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`${styles.shell} ${open ? "" : styles.shellCollapsed}`}
      >
        <Sidebar
          session={session}
          user={user}
          collapsed={!open}
          onClose={() => setOpen(false)}
        />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
