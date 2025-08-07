// types/next-auth.d.ts
import NextAuth, { DefaultSession } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * The user object returned from the `authorize` callback.
   * We add our custom properties to it.
   */
  interface User {
    tenantId: string;
    subdomain: string;
    role: {
      id: string;
      name: string;
      permissions: string[];
    };
  }

  /**
   * The session object available on the client (`useSession`).
   * We add our custom properties to the `user` object within the session.
   */
  interface Session {
    user: {
      id: string; // The user's database ID
      tenantId: string; // The tenant the user belongs to
      subdomain: string; // The tenant's subdomain for redirects
      role: {
        id: string;
        name: string;
        permissions: string[];
      };
    } & DefaultSession['user']; // This keeps the default properties like name, email, image
  }
}

declare module 'next-auth/jwt' {
  /**
   * The JWT token that is stored and passed between server-side functions.
   * We add our custom properties here to persist them across requests.
   */
  interface JWT extends DefaultJWT {
    id: string;
    tenantId: string;
    subdomain: string;
    role: {
      id: string;
      name: string;
      permissions: string[];
    };
  }
}