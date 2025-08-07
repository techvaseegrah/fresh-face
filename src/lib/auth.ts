// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectToDatabase from '@/lib/mongodb';
import { getToken } from 'next-auth/jwt'; 
import User from '@/models/user';
import Tenant from '@/models/Tenant';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        // We now expect the form to send a 'subdomain'
        subdomain: { label: 'Salon ID', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // We now require all three fields
        if (!credentials?.subdomain || !credentials?.email || !credentials?.password) {
          throw new Error('Salon ID, email, and password are required.');
        }

        const { subdomain, email, password } = credentials;

        try {
          await connectToDatabase();
          
          // The subdomain now comes dynamically from the form
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
            select: 'name permissions isActive'
          });

          if (!user || !user.roleId || !user.roleId.isActive) {
            throw new Error('Invalid credentials for this salon.');
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
              permissions: user.roleId.permissions
            }
          };
        } catch (error) {
          console.error('Authorization Error:', error);
          throw new Error('An unexpected error occurred.');
        }
      }
    })
  ],
  // --- COOKIE CONFIGURATION IS NO LONGER NEEDED FOR MODHEADER ---
  // We can remove this block as we are always on the same 'localhost' domain.
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
        session.user.role = token.role as any;
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
export function extractTokenFromRequest(req: NextRequest): string | null {
  // Logic to determine the cookie name based on environment
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
      req: null, // Pass null because we are providing the raw token
      secret: process.env.NEXTAUTH_SECRET!,
      raw: token,
    });

    if (decodedToken) {
      // Reshape the decoded token to a simple object the middleware can use
      return {
        id: decodedToken.id,
        email: decodedToken.email,
        tenantId: decodedToken.tenantId,
        permissions: (decodedToken.role as any)?.permissions || [],
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
  // Check for wildcard (super admin)
  if (userPermissions.includes('*')) {
    return true;
  }
  // Check for the specific permission
  return userPermissions.includes(requiredPermission);
}