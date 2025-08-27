// /lib/auth.ts - FINAL CORRECTED VERSION

import { NextAuthOptions } from 'next-auth';
import { NextRequest } from 'next/server';
import CredentialsProvider from 'next-auth/providers/credentials';
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
      name: 'credentials',
      credentials: {
        subdomain: { label: 'Salon ID', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.subdomain || !credentials?.email || !credentials?.password) { throw new Error('Salon ID, email, and password are required.'); }
        const host = (req.headers as Record<string, string> | undefined)?.host;
        if (!host) { throw new Error('Could not determine the request host.'); }

        const subdomainFromUrl = host.split('.')[0];
        if (subdomainFromUrl.toLowerCase() !== credentials.subdomain.toLowerCase()) {
            throw new Error('The Salon ID entered does not match the website URL.');
        }
        
        const { subdomain, email, password } = credentials;
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
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; token.role = user.role;
        token.tenantId = user.tenantId; token.subdomain = user.subdomain;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string; session.user.role = token.role as any;
        session.user.tenantId = token.tenantId as string; session.user.subdomain = token.subdomain as string;
      }
      return session;
    }
  },
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
    return null;
  }
}

export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(requiredPermission);
}