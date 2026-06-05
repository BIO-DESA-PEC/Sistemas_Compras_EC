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
  Truck,
  CalendarRange,
  Settings2,
  CreditCard
} from "lucide-react";
import styles from "./sidebar.module.css";

export default function Sidebar({ session, user, collapsed }) {
  const rolNombre = (user?.RolNombre || "").trim().toUpperCase();
  const rolId = Number(user?.RolId);

  // ✅ Roles
  const isAdmin = rolId === 1 || rolNombre === "ADMINISTRADOR";
  const isUsuario = rolId === 3 || rolNombre === "USUARIO";
  const isCompras = rolId === 6 || rolNombre === "COMPRAS";
  const isData = rolId === 5 || rolNombre === "DATA";
  const isContabilidad = rolId === 4 || rolNombre === "CONTABILIDAD";

  // ✅ FACTURAS SAP: SOLO Admin + Data
  const canSeeFacturasSap = isAdmin || isData;

  // ✅ ADMIN GENERAL: SOLO Admin
  const canSeeAdmin = isAdmin;

  // ✅ Aprobaciones: Admin + Jefe TI (si mantienes eso)
  const canSeeAprobaciones = isAdmin || rolId === 2 || rolNombre === "JEFE TI";

  // ✅ Anticipos: Admin + Compras
  const canSeeAnticipos = isAdmin || isCompras;

  // ✅ PROVEEDORES: SOLO Admin + Compras
  const canSeeProveedores = isAdmin || isCompras;

  const dashboardHref = isData
    ? "/facturas-sap"
    : isContabilidad
    ? "/ordenes"
    : "/dashboard";

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
        {/* ✅ DATA: SOLO FACTURAS SAP */}
        {isData ? (
          <>
            <div className={styles.sectionLabel}>Finanzas</div>
            <a href="/facturas-sap" className={styles.item}>
              <FileText size={18} />
              <span>Facturas SAP</span>
            </a>
          </>
        ) : isContabilidad ? (
          /* ✅ CONTABILIDAD: SOLO ÓRDENES DE COMPRA */
          <>
            <div className={styles.sectionLabel}>Compras</div>
            <a href="/ordenes" className={styles.item}>
              <FileText size={18} />
              <span>Órdenes de compra</span>
            </a>
          </>
        ) : isUsuario ? (
          /* ✅ USUARIO (RolId 3): SOLO Dashboard + Nueva solicitud + Solicitudes */
          <>
  <div className={styles.sectionLabel}>General</div>
  <a href="/dashboard" className={styles.item}>
    <LayoutDashboard size={18} />
    <span>Dashboard</span>
  </a>

  <div className={styles.sectionLabel}>Compras</div>
  <a href="/solicitudes/new" className={styles.item}>
    <ShoppingCart size={18} />
    <span>Nueva solicitud</span>
  </a>

  <a href="/solicitudes-mensuales" className={styles.item}>
    <CalendarRange size={18} />
    <span>Solicitudes mensuales</span>
  </a>

  <a href="/solicitudes" className={styles.item}>
    <ListChecks size={18} />
    <span>Solicitudes</span>
  </a>
</>
        ) : (
          /* ✅ RESTO (Admin, Compras, Jefe TI, etc.) */
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
            <a href="/solicitudes-mensuales" className={styles.item}>
  <CalendarRange size={18} />
  <span>Solicitudes mensuales</span>
</a>
{(isAdmin || isCompras) && (
  <a href="/plantillas-mensuales" className={styles.item}>
    <Settings2 size={18} />
    <span>Plantillas mensuales</span>
  </a>
)}
{(isAdmin || isCompras) && (
  <>
    <div className={styles.sectionLabel}>Finanzas</div>

    <a href="/tarjetas-credito" className={styles.item}>
      <CreditCard size={18} />
      <span>Tarjetas de crédito</span>
    </a>
  </>
)}
{(isAdmin || isCompras) && (
  <a href="/reportes" className={styles.item}>
    <FileText size={18} />
    <span>Reportes</span>
  </a>
)}
            <a href="/solicitudes" className={styles.item}>
              <ListChecks size={18} />
              <span>Solicitudes</span>
            </a>

            <a href="/preordenes" className={styles.item}>
              <ClipboardList size={18} />
              <span>Pre-órdenes de compra</span>
            </a>

            {canSeeProveedores && (
              <a href="/proveedores" className={styles.item}>
                <Truck size={18} />
                <span>Proveedores</span>
              </a>
            )}

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
                  <a href="/aprobaciones/solicitudes" className={styles.subitem}>
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

            {canSeeAdmin && (
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

      {/* 👤 Usuario + logout */}
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
