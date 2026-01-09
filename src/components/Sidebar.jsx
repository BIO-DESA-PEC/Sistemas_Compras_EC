// src/components/Sidebar.jsx
"use client";

import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ShoppingCart,
  ListChecks,
  FileText,
  CheckSquare,
  ClipboardList,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import styles from "./sidebar.module.css";

export default function Sidebar({ session, user, collapsed }) {
  const isData = user?.RolId === 5 || user?.RolNombre === "Data";

  const isAdmin = user?.RolId === 1 || user?.RolNombre === "Administrador";

  const canSeeAprobaciones =
    isAdmin || user?.RolId === 2 || user?.RolNombre === "Jefe TI";

  // ✅ Facturas SAP: Admin + Contabilidad + RolId 4 + Data (RolId 5)
  const canSeeFacturasSap =
    isAdmin ||
    user?.RolNombre === "Contabilidad" ||
    user?.RolId === 4 ||
    isData;

  const canSeeAnticipos =
    isAdmin || user?.RolId === 6 || user?.RolNombre === "Compras";

  // Si es Data, que el "home" lo mande a Facturas SAP
  const dashboardHref = isData ? "/facturas-sap" : "/dashboard";

  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      {/* BRAND */}
      <div className={styles.topBrand}>
        <div className={styles.brandDot}>BIO</div>
        <div className={styles.brandText}>
          BIOCELLS DISCOVERIES INTERNACIONAL S.A.
        </div>
      </div>

      <nav className={styles.nav}>
        {/* ✅ SI ES DATA: SOLO FACTURAS SAP */}
        {isData ? (
          <>
            <div className={styles.sectionLabel}>Finanzas</div>
            {canSeeFacturasSap && (
              <a href="/facturas-sap" className={styles.item}>
                <FileText size={18} />
                <span>Facturas SAP</span>
              </a>
            )}
          </>
        ) : (
          <>
            <div className={styles.sectionLabel}>General</div>

            <a href={dashboardHref} className={styles.item}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </a>

            <div className={styles.sectionLabel}>Compras</div>

            <a href="/solicitudes/new" className={styles.item}>
              <ShoppingCart size={18} />
              <span>Nueva solicitud</span>
            </a>

            <a href="/solicitudes" className={styles.item}>
              <ListChecks size={18} />
              <span>Solicitudes</span>
            </a>

            <a href="/preordenes" className={styles.item}>
              <ClipboardList size={18} />
              <span>Pre-órdenes de compra</span>
            </a>

            {canSeeAnticipos && (
              <a href="/anticipos" className={styles.item}>
                <FileText size={18} />
                <span>Anticipos</span>
              </a>
            )}

            <a href="/ordenes" className={styles.item}>
              <FileText size={18} />
              <span>Órdenes de compra</span>
            </a>

            {canSeeAprobaciones && (
              <>
                <div className={styles.sectionLabel}>
                  Control y aprobaciones
                </div>

                <a href="/aprobaciones" className={styles.item}>
                  <CheckSquare size={18} />
                  <span>Aprobaciones</span>
                </a>

                <div className={styles.submenu}>
                  <a
                    href="/aprobaciones/solicitudes"
                    className={styles.subitem}
                  >
                    Solicitudes
                  </a>
                </div>
              </>
            )}

            {canSeeFacturasSap && (
              <>
                <div className={styles.sectionLabel}>Finanzas</div>
                <a href="/facturas-sap" className={styles.item}>
                  <FileText size={18} />
                  <span>Facturas SAP</span>
                </a>
              </>
            )}

            {isAdmin && (
              <>
                <div className={styles.sectionLabel}>Administración</div>

                <a href="/admin" className={styles.item}>
                  <ShieldCheck size={18} />
                  <span>Administración general</span>
                </a>

                <div className={styles.submenu}>
                  <a href="/admin/usuarios" className={styles.subitem}>
                    Usuarios
                  </a>
                  <a href="/admin/roles" className={styles.subitem}>
                    Roles
                  </a>
                  <a href="/admin/departamentos" className={styles.subitem}>
                    Departamentos
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </nav>

      {/* 👤 Usuario + icono logout */}
      <div className={styles.bottomUser}>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{session?.user?.name ?? ""}</div>
          <div className={styles.userMail}>{session?.user?.email ?? ""}</div>
        </div>
        <button
          className={styles.userLogout}
          type="button"
          onClick={() => signOut()}
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
