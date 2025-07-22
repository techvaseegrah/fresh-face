// app/api/users/[userId]/route.ts

import { NextResponse } from 'next/server';
import User from '@/models/user';
import { revalidatePath } from 'next/cache';
import connectToDatabase from '@/lib/mongodb';

export async function PUT(request: { json: () => PromiseLike<{ name: any; }> | { name: any; }; }, { params }: any) {
  const { name } = await request.json();
  await connectToDatabase();
  await User.findByIdAndUpdate(params.userId, { name });
  revalidatePath('/api/users/billing-staff');
  return NextResponse.json({ success: true });
}

export async function DELETE(request: any, { params }: any) {
  await connectToDatabase();
  await User.deleteOne({ _id: params.userId });
  revalidatePath('/api/users/billing-staff');
  return NextResponse.json({ success: true });
}
