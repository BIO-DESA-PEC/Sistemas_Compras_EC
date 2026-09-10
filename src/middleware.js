// middleware.js
import { auth } from "@/auth"; // ajusta el path según dónde esté tu archivo actual (auth.js)

const PROTECTED_PATHS = [
  "/dashboard",
  "/solicitudes",
  "/solicitudes-mensuales",
  "/plantillas-mensuales",
  "/anticipos",
  "/preordenes",
  "/proveedores",
  "/ordenes",
  "/tarjetas-credito",
  "/reportes",
  "/facturas-sap",
  "/repositorio-facturas",
  "/aprobaciones",
  "/admin",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname); // para regresarlo ahí después
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/solicitudes/:path*",
    "/solicitudes-mensuales/:path*",
    "/plantillas-mensuales/:path*",
    "/anticipos/:path*",
    "/preordenes/:path*",
    "/proveedores/:path*",
    "/ordenes/:path*",
    "/tarjetas-credito/:path*",
    "/reportes/:path*",
    "/facturas-sap/:path*",
    "/repositorio-facturas/:path*",
    "/aprobaciones/:path*",
    "/admin/:path*",
  ],
};