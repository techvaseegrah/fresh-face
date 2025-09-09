import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  tenantId: { 
    type: require('mongoose').Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
  },
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  
  // <-- ADD THIS SECTION -->
  canHandleBilling: {
    type: Boolean,
    required: true, // `required` with a `default` ensures the field always exists
    default: false, // Default to false for safety. New roles won't get billing access by accident.
  },
  // <-- END OF NEW SECTION -->

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemRole: {
    type: Boolean,
    default: false // Super admin and other system roles
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
   updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
}, { timestamps: true });

roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

// Index for faster permission checks
roleSchema.index({ name: 1, isActive: 1 });

// <-- ADD THIS NEW INDEX -->
// This will make our API query for billing staff very efficient.
roleSchema.index({ tenantId: 1, canHandleBilling: 1 });

export default mongoose.models.Role || mongoose.model('Role', roleSchema);