// lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import { NextRequest } from 'next/server';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getToken } from 'next-auth/jwt';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Tenant from '@/models/Tenant'; // Ensure this path is correct

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        subdomain: { label: 'Salon ID', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.subdomain || !credentials?.email || !credentials?.password) {
          throw new Error('Salon ID, email, and password are required.');
        }

        const host = (req.headers as Record<string, string> | undefined)?.host;
        if (!host) {
          throw new Error('Could not determine the request host.');
        }
        const subdomainFromUrl = host.split('.')[0];

        if (subdomainFromUrl.toLowerCase() !== credentials.subdomain.toLowerCase()) {
            throw new Error('The Salon ID entered does not match the website URL.');
        }
        
        const { subdomain, email, password } = credentials;

        try {
          await connectToDatabase();
          
          const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() }).lean();

          if (!tenant) {
            throw new Error('Invalid Salon ID.');
          }

          const user = await User.findOne({ 
            email: email.toLowerCase(),
            tenantId: tenant._id,
            isActive: true 
          }).populate({
            path: 'roleId',
            // <<< CORRECTION 1 of 2: Added 'displayName' to the database query.
            select: 'name displayName permissions isActive'
          });

          if (!user || !user.roleId || !user.roleId.isActive) {
            throw new Error('Invalid credentials or inactive account for this salon.');
          }

          const isPasswordValid = await user.comparePassword(password);
          if (!isPasswordValid) {
            throw new Error('Invalid credentials.');
          }

          User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).exec();

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            tenantId: tenant._id.toString(),
            subdomain: tenant.subdomain,
            role: {
              id: user.roleId._id.toString(),
              name: user.roleId.name,
              // <<< CORRECTION 2 of 2: Added 'displayName' to the returned role object.
              displayName: user.roleId.displayName, 
              permissions: user.roleId.permissions
            }
          };
        } catch (error: any) {
          if (error.message.includes('Invalid') || error.message.includes('match')) {
              throw new Error(error.message);
          }
          console.error('Authorization Error:', error);
          throw new Error('An unexpected server error occurred during login.');
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.subdomain = user.subdomain;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as { id: string; name: string; displayName: string; permissions: string[] };
        session.user.tenantId = token.tenantId as string;
        session.user.subdomain = token.subdomain as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET,
};


// The helper functions below are not part of authOptions,
// but they are correctly placed in this file for co-location.

/**
 * Extracts the raw JWT string from the request cookies.
 * Used by the middleware to get the token for decoding.
 */
export function extractTokenFromRequest(req: NextRequest): string | null {
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
  
  const token = req.cookies.get(cookieName)?.value;
  return token || null;
}

/**
 * Decodes the JWT token to get the user's session data.
 * This is a server-side function used by the middleware.
 */
export async function getUserFromToken(token: string): Promise<any | null> {
  try {
    const decodedToken = await getToken({
      req: null, 
      secret: process.env.NEXTAUTH_SECRET!,
      raw: token,
    });

    if (decodedToken) {
      return {
        id: decodedToken.id,
        email: decodedToken.email,
        tenantId: decodedToken.tenantId,
        permissions: (decodedToken.role as any)?.permissions || [],
        subdomain: decodedToken.subdomain,
      };
    }
    return null;
  } catch (error) {
    console.error("Error decoding token in getUserFromToken:", error);
    return null;
  }
}

/**
 * Checks if a user's permission list includes a required permission.
 */
export function hasPermission(userPermissions: string[] | undefined, requiredPermission: string): boolean {
  if (!userPermissions) {
    return false;
  }
  if (userPermissions.includes('*')) {
    return true;
  }
  return userPermissions.includes(requiredPermission);
}