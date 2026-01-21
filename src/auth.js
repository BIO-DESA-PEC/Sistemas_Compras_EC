import NextAuth from "next-auth";
import MicrosoftEntraID from "@auth/core/providers/microsoft-entra-id";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // 🔐 Proveedor Microsoft Entra ID
  providers: [
    MicrosoftEntraID({
      clientId:     process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer:       process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope:  "openid profile email offline_access User.Read",
          prompt: "login",
        },
      },
    }),
  ],

  // 🔑 Sesiones JWT
  session: { strategy: "jwt" },
  //secret:  process.env.NEXTAUTH_SECRET,

  // ⚙️ Callbacks mínimos
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.email       = profile.email || profile.preferred_username;
        token.name        = profile.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.email  = token.email;
      session.user.name   = token.name;
      return session;
    },

    async redirect() {
      return "/dashboard";
    },
  },
});
