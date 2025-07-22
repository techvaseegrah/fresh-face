// app/actions/users.ts
'use server';

import { revalidatePath } from 'next/cache';
import User from '@/models/user';
import connectToDatabase from '@/lib/mongodb';

export async function updateUserHandler(userId: string, name: string) {
  await connectToDatabase();
  await User.findByIdAndUpdate(userId, { name });
  revalidatePath('/api/users/billing-staff');
}

export async function deleteUserHandler(userId: string) {
  await connectToDatabase();
  await User.deleteOne({ _id: userId });
  revalidatePath('/api/users/billing-staff');
}
