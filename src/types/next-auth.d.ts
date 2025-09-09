// types/next-auth.d.ts

import NextAuth, { DefaultSession } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

// Define the shape of your role once
interface IUserRole {
  id: string;
  name: string;
  displayName?: string; // Add this optional property
  permissions: string[];
}

declare module 'next-auth' {
  /**
   * The user object returned from the `authorize` callback.
   */
  interface User {
    tenantId: string;
    subdomain: string;
    role: IUserRole; // Use the interface
  }

  /**
   * The session object available on the client (`useSession`).
   */
  interface Session {
    user: {
      id: string;
      tenantId: string;
      subdomain: string;
      role: IUserRole; // Use the interface
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /**
   * The JWT token that is stored and passed between server-side functions.
   */
  interface JWT extends DefaultJWT {
    id: string;
    tenantId: string;
    subdomain: string;
    roleId: string; // Use the interface
  }
}