import "next-auth";

declare module "next-auth" {
  interface Session {
    /** True only for the session created by the sign-in that made this account. */
    isNewUser?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isNewUser?: boolean;
  }
}
