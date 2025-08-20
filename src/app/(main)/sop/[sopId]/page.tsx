import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopViewer from './SopViewer';

async function getSopData(sopId, tenantId) {
  await dbConnect();
  // We don't add role checks here because if a user has a direct link, they should see it.
  // The main library page already filters by role.
  const sop = await Sop.findOne({ _id: sopId, tenantId }).populate('roles', 'displayName').lean();
  if (!sop) return null;
  // Convert ObjectId to string for client component serialization
  return JSON.parse(JSON.stringify(sop));
}

export default async function SopDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  const sop = await getSopData(params.sopId, session.user.tenantId);

  if (!sop) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">SOP Not Found</h1>
        <p>The requested SOP could not be found or you do not have permission to view it.</p>
      </div>
    );
  }

  return <SopViewer sop={sop} />;
}