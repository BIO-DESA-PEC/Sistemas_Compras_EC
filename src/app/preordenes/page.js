import { auth } from "@/auth";
import { getUserByEmail } from "@/app/lib/backend";
import Link from "next/link";
import RowActions from "./RowActions";
import styles from "./preordenes.module.css";
import CreatePreOCModalButton from "./CreatePreOCModalButton";

const PAGE_SIZE_DEFAULT = 15;

async function fetchList({ page, pageSize, q, userId }) {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://back-compras-ec.onrender.com";

  const qp = new URLSearchParams();
  qp.set("page", String(page || 1));
  qp.set("pageSize", String(pageSize || PAGE_SIZE_DEFAULT));
  if (q) qp.set("q", q);
  if (userId) qp.set("userId", String(userId));

  const res = await fetch(`${base}/api/preoc?${qp.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) return { page, pageSize, totalRows: 0, items: [] };
  return res.json();
}

function estadoBadge(estado, styles) {
  const e = String(estado || "").toUpperCase();

  if (e === "SEPARADA") return `${styles.badge} ${styles.badgeSplit}`;
  if (e === "APROBADA") return `${styles.badge} ${styles.badgeApproved}`;
  return `${styles.badge} ${styles.badgeDraft}`;
}

function pageWindow(page, totalPages, span = 1) {
  const out = new Set([1, totalPages, page]);

  for (let i = 1; i <= span; i++) {
    out.add(page - i);
    out.add(page + i);
  }

  return [...out]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

function pager({ page, totalRows, pageSize, q }) {
  const totalPages = Math.max(1, Math.ceil((totalRows || 0) / pageSize));

  const makeHref = (p) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    u.set("page", String(p));
    u.set("pageSize", String(pageSize));
    return `/preordenes?${u.toString()}`;
  };

  return { totalPages, makeHref };
}

export default async function PreOCListPage({ searchParams }) {
  const session = await auth();
  const user = session ? await getUserByEmail(session.user.email) : null;

  const userIdRaw =
    user?.IdUsuario ??
    user?.Id ??
    user?.id ??
    user?.ID ??
    session?.user?.id ??
    null;

  const userId = userIdRaw != null ? Number(userIdRaw) : null;
  const userEmail = session?.user?.email ?? null;

  const sp = await searchParams;

  const page = Number(sp?.page ?? 1);
  const pageSize = Number(sp?.pageSize ?? PAGE_SIZE_DEFAULT);
  const q = String(sp?.q ?? "").trim();

  const data = await fetchList({ page, pageSize, q, userId });
  const items = data?.items ?? [];

  const { totalPages, makeHref } = pager({
    page,
    totalRows: data?.totalRows || 0,
    pageSize,
    q,
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.headerCard}>
        <h1>Pre-Órdenes de compra</h1>
      </div>

      <form className={styles.searchBar} method="get">
        <input
          name="q"
          className={styles.searchInput}
          placeholder="Buscar por #PreOC o #Solicitud…"
          defaultValue={q}
        />

        <input type="hidden" name="pageSize" value={pageSize} />

        <button className={styles.primary} type="submit">
          Buscar
        </button>

        <CreatePreOCModalButton
          userId={userId}
          departamentoId={user?.DepartamentoId ?? user?.DepartamentoID ?? null}
        />

        {q && (
          <Link className={styles.secondary} href="/preordenes">
            Limpiar
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>No hay pre-órdenes listadas{q ? " para tu búsqueda." : " aún."}</p>
        </div>
      ) : (
        <>
          <div className={styles.table}>
            <div className={`${styles.row} ${styles.header}`}>
              <div>#PreOC</div>
              <div>#Solicitud</div>
              <div>Fecha</div>
              <div>Solicitó</div>
              <div>Último aprobador</div>
              <div className={styles.num}>Renglones</div>
              <div className={styles.num}>Total</div>
              <div>Estado</div>
              <div className={styles.actionsHead}>Acciones</div>
            </div>

            {items.map((it) => {
              const idPreoc = Number(it.IdPreOC);

              return (
                <div key={idPreoc} className={styles.row}>
                  <Link
                    href={`/preordenes/${idPreoc}`}
                    className={styles.rowMain}
                  >
                    <div>#{idPreoc}</div>

                    <div>#{it.IdSolicitud}</div>

                    <div className={styles.dateText}>
                      {String(it.FechaCreacion).replace("T", " ").slice(0, 19)}
                    </div>

                    <div className={styles.textEllipsis} title={it.SolicitanteNombre || ""}>
                      {it.SolicitanteNombre || "—"}
                    </div>

                    <div
                      className={styles.textEllipsis}
                      title={
                        it.UltimoNivelAprobacion
                          ? `${it.UltimoAprobadorNombre || "—"} (${it.UltimoNivelAprobacion})`
                          : (it.UltimoAprobadorNombre || "")
                      }
                    >
                      {it.UltimoAprobadorNombre
                        ? `${it.UltimoAprobadorNombre}${it.UltimoNivelAprobacion ? ` (${it.UltimoNivelAprobacion})` : ""}`
                        : "—"}
                    </div>

                    <div className={styles.num}>{it.Renglones}</div>

                    <div className={styles.num}>
                      {Number(it.Total || 0).toFixed(2)}
                    </div>

                    <div>
                      <span className={estadoBadge(it.Estado, styles)}>
                        {it.Estado || "—"}
                      </span>
                    </div>
                  </Link>

                  <div className={styles.actionsCell}>
                    <RowActions
                      idPreoc={idPreoc}
                      isFav={!!it.IsFavorita}
                      userId={userId}
                      userEmail={userEmail}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.footerBar}>
            <nav className={styles.pagination}>
              <Link href={makeHref(1)} className={styles.pillIcon}>
                «
              </Link>

              {pageWindow(page, totalPages).map((p) => (
                <Link
                  key={p}
                  href={makeHref(p)}
                  className={`${styles.pill} ${p === page ? styles.pillActive : ""}`}
                >
                  {p}
                </Link>
              ))}

              <Link href={makeHref(totalPages)} className={styles.pillIcon}>
                »
              </Link>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}