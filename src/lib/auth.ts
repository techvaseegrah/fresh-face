// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/user';
import Role from '@/models/role';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await connectToDatabase();
          
          const user = await User.findOne({ 
            email: credentials.email.toLowerCase(),
            isActive: true 
          }).populate({
            path: 'roleId',
            select: 'name permissions isActive'
          });

          if (!user || !user.roleId || !user.roleId.isActive) {
            return null;
          }

          const isPasswordValid = await user.comparePassword(credentials.password);
          if (!isPasswordValid) {
            return null;
          }

          // Update last login
          await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: {
              id: user.roleId._id.toString(),
              name: user.roleId.name,
              permissions: user.roleId.permissions
            }
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],

  callbacks: {
    // This function is called when the JWT is created.
    async jwt({ token, user }) {
      // `user` is only passed on the initial sign-in.
      if (user) {
        // We explicitly add the user's database ID and role to the token.
        // This is clearer than relying on the default 'sub' claim.
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    // This function is called whenever the session is accessed.
    async session({ session, token }) {
      // We transfer our custom properties from the token to the session object.
      // This is what `useSession` and `getServerSession` will see.
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as { id: string; name: string; permissions: string[] };
      }
      return session;
    }
  },
  
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  }
};