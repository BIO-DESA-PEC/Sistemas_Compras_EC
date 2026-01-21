import { auth, signIn } from "@/auth";
import styles from "./page.module.css";
import { Poppins } from "next/font/google";

const poppins = Poppins({ subsets: ["latin"], weight: ["400","600","800"] });

export default async function Page() {
  const session = await auth();

  const BrandPanel = () => (
    <div className={styles.brand}>
      <div className={styles.brandInner}>
        <img className={styles.logo} src="/biocells-logo.png" alt="BIOCELLS" />
        <div className={styles.company}>BIOCELLS DISCOVERIES INTERNACIONAL S.A.</div>
        <div className={styles.system}>SISTEMA DE COMPRAS EC</div>
      </div>
    </div>
  );

  if (session) {
    return (
      <div className={`${styles.wrap} ${poppins.className}`}>
        <div className={styles.card}>
          <BrandPanel />
          <div className={styles.form}>
            <div className={styles.formInner}>
              <h1 className={styles.heading}>Hola, {session.user?.name}</h1>
              <p className={styles.sub}>Ya estás autenticado.</p>

              <div className={styles.btnGroup}>
                <a className={styles.msBtn} href="/dashboard">Ir al Dashboard</a>
                <form
                  action={async () => {
                    "use server";
                    const { signOut } = await import("@/auth");
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className={styles.msBtn} type="submit">
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${poppins.className}`}>
      <div className={styles.card}>
        <BrandPanel />
        <div className={styles.form}>
          <div className={styles.formInner}>
            <h1 className={styles.heading}>Inicia sesión</h1>
            <p className={styles.sub}>Usa tu cuenta de Microsoft 365 para continuar.</p>
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id");
              }}
            >
              <button className={styles.msBtn} type="submit" aria-label="Iniciar sesión con Microsoft">
                <span className={styles.msIcon}>
                  <span className={styles.msR}></span>
                  <span className={styles.msG}></span>
                  <span className={styles.msB}></span>
                  <span className={styles.msY}></span>
                </span>
                Iniciar sesión con Microsoft
              </button>
            </form>
            <div className={styles.hr}></div>
            <p className={styles.hint}>¿Problemas? Contacta a Compras/IT.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
