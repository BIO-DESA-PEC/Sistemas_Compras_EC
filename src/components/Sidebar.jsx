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
  CreditCard,
} from "lucide-react";
import styles from "./sidebar.module.css";

export default function Sidebar({ session, user, collapsed }) {
  const rolNombre = (user?.RolNombre || "").trim().toUpperCase();
  const rolId = Number(user?.RolId);

  const userEmail = (session?.user?.email || user?.Correo || "")
    .trim()
    .toLowerCase();

  const isAdmin = rolId === 1 || rolNombre === "ADMINISTRADOR";
  const isJefeTI = rolId === 2 || rolNombre === "JEFE TI";
  const isUsuario = rolId === 3 || rolNombre === "USUARIO";
  const isContabilidad = rolId === 4 || rolNombre === "CONTABILIDAD";
  const isData = rolId === 5 || rolNombre === "DATA";
  const isCompras = rolId === 6 || rolNombre === "COMPRAS";
  const isInvitado = rolId === 8 || rolNombre === "INVITADO";
  const isBrithanny = userEmail === "brithanny.ortega@biocellsmed.com";

  const canSeeDashboard = isAdmin || isCompras;

  const canSeeNuevaSolicitud =
    isAdmin || isUsuario || isJefeTI || isCompras || isContabilidad || isData;

  const canSeeSolicitudAnticipo =
    isAdmin || isUsuario || isJefeTI || isCompras || isContabilidad || isData;

  const canSeeSolicitudesMensuales =
    isAdmin || isUsuario || isJefeTI || isCompras || isContabilidad || isData;

  const canSeePlantillasMensuales = isAdmin || isCompras;
  const canSeeTarjetasCredito = isAdmin || isCompras;
  const canSeeAnticipos = isAdmin || isCompras || isContabilidad;
  const canSeeReportes = isAdmin || isCompras || isContabilidad;
  const canSeeSolicitudes = isAdmin || isCompras|| isUsuario;
  const canSeePreordenes = isAdmin || isCompras;
  const canSeeProveedores = isAdmin || isCompras || isContabilidad;

  const canSeeOrdenes =
    isAdmin || isCompras || isContabilidad || isData || isInvitado || isBrithanny;

  const canSeeAprobaciones = isAdmin || isJefeTI;
  const canSeeFacturasSap = isAdmin || isData;
  const canSeeAdminGeneral = isAdmin;

  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <div className={styles.topBrand}>
        <div className={styles.brandDot}>BIO</div>
        <div className={styles.brandText}>
          BIOCELLS DISCOVERIES INTERNACIONAL S.A.
        </div>
      </div>

      <nav className={styles.nav}>
        {canSeeDashboard && (
          <>
            <div className={styles.sectionLabel}>General</div>
            <a href="/dashboard" className={styles.item}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </a>
          </>
        )}

        {(canSeeNuevaSolicitud ||
          canSeeSolicitudAnticipo ||
          canSeeSolicitudesMensuales ||
          canSeePlantillasMensuales ||
          canSeeSolicitudes ||
          canSeePreordenes ||
          canSeeProveedores ||
          canSeeOrdenes) && (
          <div className={styles.sectionLabel}>Compras</div>
        )}

        {canSeeNuevaSolicitud && (
          <a href="/solicitudes/new" className={styles.item}>
            <ShoppingCart size={18} />
            <span>Nueva solicitud</span>
          </a>
        )}

        {canSeeSolicitudAnticipo && (
          <a href="/anticipos/new" className={styles.item}>
            <FileText size={18} />
            <span>Solicitud de anticipo</span>
          </a>
        )}

        {canSeeSolicitudesMensuales && (
          <a href="/solicitudes-mensuales" className={styles.item}>
            <CalendarRange size={18} />
            <span>Solicitudes mensuales</span>
          </a>
        )}

        {canSeePlantillasMensuales && (
          <a href="/plantillas-mensuales" className={styles.item}>
            <Settings2 size={18} />
            <span>Plantillas mensuales</span>
          </a>
        )}

        {canSeeSolicitudes && (
          <a href="/solicitudes" className={styles.item}>
            <ListChecks size={18} />
            <span>Solicitudes</span>
          </a>
        )}

        {canSeePreordenes && (
          <a href="/preordenes" className={styles.item}>
            <ClipboardList size={18} />
            <span>Pre-órdenes de compra</span>
          </a>
        )}

        {canSeeProveedores && (
          <a href="/proveedores" className={styles.item}>
            <Truck size={18} />
            <span>Proveedores</span>
          </a>
        )}

        {canSeeOrdenes && (
          <a href="/ordenes" className={styles.item}>
            <FileText size={18} />
            <span>Órdenes de compra</span>
          </a>
        )}

        {(canSeeTarjetasCredito ||
          canSeeAnticipos ||
          canSeeReportes ||
          canSeeFacturasSap) && (
          <div className={styles.sectionLabel}>Finanzas</div>
        )}

        {canSeeTarjetasCredito && (
          <a href="/tarjetas-credito" className={styles.item}>
            <CreditCard size={18} />
            <span>Tarjetas de crédito</span>
          </a>
        )}

        {canSeeAnticipos && (
          <a href="/anticipos" className={styles.item}>
            <FileText size={18} />
            <span>Anticipos</span>
          </a>
        )}

        {canSeeReportes && (
          <a href="/reportes" className={styles.item}>
            <FileText size={18} />
            <span>Reportes</span>
          </a>
        )}

        {canSeeFacturasSap && (
          <a href="/facturas-sap" className={styles.item}>
            <FileText size={18} />
            <span>Facturas SAP</span>
          </a>
        )}

        {canSeeAprobaciones && (
          <>
            <div className={styles.sectionLabel}>Control y aprobaciones</div>

            <a href="/aprobaciones" className={styles.item}>
              <CheckSquare size={18} />
              <span>Aprobaciones</span>
            </a>

            <div className={styles.submenu}>
            <a href="/aprobaciones/solicitudes" className={styles.subitem}>
              Solicitudes pendientes
            </a>

            <a href="/aprobaciones/aprobadas" className={styles.subitem}>
              Mis aprobaciones
            </a>
          </div>
          </>
        )}

        {canSeeAdminGeneral && (
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
      </nav>

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