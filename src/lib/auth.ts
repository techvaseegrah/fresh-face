<<<<<<< HEAD
// lib/auth.ts
=======
// /lib/auth.ts - FINAL CORRECTED VERSION
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624

import { NextAuthOptions } from 'next-auth';
import { NextRequest } from 'next/server';
import CredentialsProvider from 'next-auth/providers/credentials';
<<<<<<< HEAD
import { getToken } from 'next-auth/jwt';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Tenant from '@/models/Tenant'; // Ensure this path is correct

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
=======
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Tenant from '@/models/Tenant';
import Staff from '@/models/staff';
import bcrypt from 'bcryptjs';
import { getToken } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
  providers: [
    // --- PROVIDER 1: Admin/Manager Login ---
    CredentialsProvider({
      id: 'credentials',
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
      name: 'credentials',
      credentials: {
        subdomain: { label: 'Salon ID', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
<<<<<<< HEAD
        if (!credentials?.subdomain || !credentials?.email || !credentials?.password) {
          throw new Error('Salon ID, email, and password are required.');
        }

        const host = (req.headers as Record<string, string> | undefined)?.host;
        if (!host) {
          throw new Error('Could not determine the request host.');
        }
        const subdomainFromUrl = host.split('.')[0];

=======
        if (!credentials?.subdomain || !credentials?.email || !credentials?.password) { throw new Error('Salon ID, email, and password are required.'); }
        const host = (req.headers as Record<string, string> | undefined)?.host;
        if (!host) { throw new Error('Could not determine the request host.'); }

        const subdomainFromUrl = host.split('.')[0];
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
        if (subdomainFromUrl.toLowerCase() !== credentials.subdomain.toLowerCase()) {
            throw new Error('The Salon ID entered does not match the website URL.');
        }
        
        const { subdomain, email, password } = credentials;
<<<<<<< HEAD

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
=======
        await connectToDatabase();
        const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() }).lean();
        if (!tenant) { throw new Error('Invalid Salon ID.'); }

        const user = await User.findOne({ 
          email: email.toLowerCase(),
          tenantId: tenant._id,
          isActive: true 
        }).populate({
          path: 'roleId',
          select: 'name displayName permissions isActive'
        });
        if (!user || !user.roleId || !user.roleId.isActive) { throw new Error('Invalid credentials or inactive account for this salon.'); }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) { throw new Error('Invalid credentials.'); }

        User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).exec();
        return {
          id: user._id.toString(), email: user.email, name: user.name,
          tenantId: tenant._id.toString(), subdomain: tenant.subdomain,
          role: {
            id: user.roleId._id.toString(), name: user.roleId.name,
            displayName: user.roleId.displayName, permissions: user.roleId.permissions
          }
        };
      }
    }),
    // --- PROVIDER 2: Staff Login ---
    CredentialsProvider({
        id: 'staff-credentials',
        name: 'Staff Credentials',
        credentials: {
          subdomain: { label: "Salon ID", type: "text" },
          staffIdNumber: { label: "Staff ID", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, req) {
          if (!credentials?.subdomain || !credentials.staffIdNumber || !credentials.password) { throw new Error('Salon ID, Staff ID, and Password are required.'); }
          const host = (req.headers as Record<string, string> | undefined)?.host;
          if (!host) { throw new Error('Could not determine the request host.'); }
          
          const subdomainFromUrl = host.split('.')[0];
          if (subdomainFromUrl.toLowerCase() !== credentials.subdomain.toLowerCase()) {
              throw new Error('The Salon ID entered does not match the website URL.');
          }

          await connectToDatabase();
          const tenant = await Tenant.findOne({ subdomain: credentials.subdomain.toLowerCase() }).lean();
          if (!tenant) { throw new Error('Invalid Salon ID.'); }
          
          const staff = await Staff.findOne({ 
            staffIdNumber: credentials.staffIdNumber,
            tenantId: tenant._id
          }).select('+password');
          if (!staff || !staff.password) { throw new Error('Invalid Staff ID or Password.'); }

          const isPasswordMatch = await bcrypt.compare(credentials.password, staff.password);
          if (!isPasswordMatch) { throw new Error('Invalid Staff ID or Password.'); }
          
          return {
            id: staff._id.toString(), name: staff.name, email: staff.email,
            tenantId: staff.tenantId.toString(), subdomain: tenant.subdomain,
            role: { 
                id: 'staff-role', name: 'staff', displayName: 'Staff', permissions: []
            },
          };
        }
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
<<<<<<< HEAD
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.subdomain = user.subdomain;
=======
        token.id = user.id; token.role = user.role;
        token.tenantId = user.tenantId; token.subdomain = user.subdomain;
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
<<<<<<< HEAD
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.tenantId = token.tenantId as string;
        session.user.subdomain = token.subdomain as string;
=======
        session.user.id = token.id as string; session.user.role = token.role as any;
        session.user.tenantId = token.tenantId as string; session.user.subdomain = token.subdomain as string;
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
      }
      return session;
    }
  },
<<<<<<< HEAD
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
=======
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

// --- Helper Functions ---
// ✅ FIX: Added 'export' to make these functions available to other files like middleware.ts
export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export async function getUserFromToken(token: string): Promise<any | null> {
  try {
    const decodedToken = await getToken({ req: {} as NextRequest, secret: process.env.NEXTAUTH_SECRET, raw: token });
    return decodedToken;
  } catch (error) {
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
    return null;
  }
}

<<<<<<< HEAD
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
=======
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  if (!userPermissions) return false;
>>>>>>> 5d822a6484c517a3f0fac76405cac7b9d5a20624
  return userPermissions.includes(requiredPermission);
}