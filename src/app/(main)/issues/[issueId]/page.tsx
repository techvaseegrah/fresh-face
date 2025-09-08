// src/app/(main)/issues/[issueId]/page.tsx

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
// --- FIX: Use a named import from the new file ---
import { IssueViewer } from './IssueViewer';
import { notFound, redirect } from 'next/navigation';

async function getIssueData(issueId: string, tenantId: string) {
  await dbConnect();
  const issue = await Issue.findOne({ _id: issueId, tenantId })
    .populate('roles', 'displayName')
    .lean();
  if (!issue) {
    notFound(); 
  }
  return JSON.parse(JSON.stringify(issue));
}

interface IssueDetailPageProps {
  params: {
    issueId: string;
  };
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    redirect('/api/auth/signin');
  }
  const issue = await getIssueData(params.issueId, session.user.tenantId);
  return <IssueViewer issue={issue} />;
}