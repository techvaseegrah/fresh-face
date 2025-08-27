// src/app/(main)/sop/[sopId]/page.tsx

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopViewer from './SopViewer';
// --- FIX: Import 'notFound' and 'redirect' from Next.js for better flow control ---
import { notFound, redirect } from 'next/navigation';

// --- FIX 1: Add string types to the function parameters ---
async function getSopData(sopId: string, tenantId: string) {
  await dbConnect();

  // The main library page already filters by role.
  const sop = await Sop.findOne({ _id: sopId, tenantId })
    .populate('roles', 'displayName')
    .lean();

  if (!sop) {
    // Use the idiomatic Next.js notFound() helper to render a 404 page
    notFound(); 
  }

  // Convert ObjectId to string for client component serialization
  return JSON.parse(JSON.stringify(sop));
}

// --- FIX 2: Define an interface for the page's props ---
interface SopDetailPageProps {
  params: {
    sopId: string;
  };
}

export default async function SopDetailPage({ params }: SopDetailPageProps) {
  const session = await getServerSession(authOptions);

  // --- FIX 3: Add a "guard clause" to handle unauthenticated users ---
  // This check MUST happen before you try to access session.user
  if (!session || !session.user) {
    // Redirect unauthenticated users to the sign-in page
    redirect('/api/auth/signin');
  }

  // Because of the check above, TypeScript now knows `session` is not null here.
  // It's safe to access session.user.tenantId.
  const sop = await getSopData(params.sopId, session.user.tenantId);
  
  // The 'if (!sop)' check is no longer needed here because getSopData will
  // call notFound() and stop execution if the SOP isn't found.

  return <SopViewer sop={sop} />;
}