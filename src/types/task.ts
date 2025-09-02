import mongoose from 'mongoose';

// This is our single, definitive interface for a Task object on the frontend.
// All components will import and use this type.
export interface Task {
  _id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  positions: string[];
  staff: { 
    _id: string; 
    name: string; 
  }[];
  checklistItems: {
    _id: mongoose.Types.ObjectId | string; // Allow string for frontend convenience
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
  }[];
}