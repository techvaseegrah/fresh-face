// app/api/appointment/[id]/route.ts
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Appointment from '@/models/appointment';
import Stylist from '@/models/Stylist';
import ServiceItem from '@/models/ServiceItem';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    const updateData = await req.json();
    const currentAppointment = await Appointment.findById(id);
    
    if (!currentAppointment) {
      return NextResponse.json({ success: false, message: "Appointment not found." }, { status: 404 });
    }

    const oldStatus = currentAppointment.status;
    const newStatus = updateData.status;

    // Calculate new estimated duration if services changed
    if (updateData.serviceIds) {
      const services = await ServiceItem.find({ 
        _id: { $in: updateData.serviceIds } 
      }).select('duration');
      
      updateData.estimatedDuration = services.reduce((total, service) => total + service.duration, 0);
    }

    // Handle status-specific updates
    if (newStatus !== oldStatus) {
      const currentTime = new Date();
      
      switch (newStatus) {
        case 'Checked-In':
          updateData.checkInTime = currentTime;
          // Lock the stylist
          const stylistToLock = await Stylist.findById(updateData.stylistId || currentAppointment.stylistId);
          if (stylistToLock) {
            await stylistToLock.lockStylist(currentAppointment._id);
          }
          break;

        case 'Checked-Out':
          updateData.checkOutTime = currentTime;
          // Calculate actual duration if checking out
          if (currentAppointment.checkInTime) {
            updateData.actualDuration = Math.round(
              (currentTime.getTime() - currentAppointment.checkInTime.getTime()) / (1000 * 60)
            );
          }
          // Unlock the stylist
          const stylistToUnlock = await Stylist.findById(updateData.stylistId || currentAppointment.stylistId);
          if (stylistToUnlock) {
            await stylistToUnlock.unlockStylist();
          }
          break;

        case 'Cancelled':
        case 'No-Show':
          // Unlock stylist if they were locked
          if (oldStatus === 'Checked-In') {
            const stylistToRelease = await Stylist.findById(updateData.stylistId || currentAppointment.stylistId);
            if (stylistToRelease) {
              await stylistToRelease.unlockStylist();
            }
          }
          break;
      }
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate(['customerId', 'stylistId', 'serviceIds']);

    return NextResponse.json({ 
      success: true, 
      appointment: updatedAppointment 
    });

  } catch (error: any) {
    console.error("API Error updating appointment:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}