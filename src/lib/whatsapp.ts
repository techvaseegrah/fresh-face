// lib/whatsapp.ts - COMPLETE FIXED VERSION
interface WhatsAppTemplate {
  name: string;
  language: {
    code: string;
  };
  components: Array<{
    type: string;
    parameters?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

interface WhatsAppMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: WhatsAppTemplate;
}

class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private enabled: boolean;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.enabled = process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true';
  }

  private async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    if (!this.enabled || !this.accessToken || !this.phoneNumberId) {
      console.log('WhatsApp notifications are disabled or missing credentials');
      return false;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API Error:', result);
        return false;
      }

      console.log('WhatsApp message sent successfully:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  // APPOINTMENT BOOKING - appointment_cnfm template (8 parameters) - FIXED
  async sendAppointmentBooking({
    phoneNumber,
    customerName,
    businessName = "FreshFace Unisex Salon",
    appointmentDate,
    appointmentTime,
    services,
    stylistName,
  }: {
    phoneNumber: string;
    customerName: string;
    businessName?: string;
    appointmentDate: string;
    appointmentTime: string;
    services: string;
    stylistName: string;
  }): Promise<boolean> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: "appointment_cnfm", // YOUR EXACT TEMPLATE NAME
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: customerName }, // {{1}} - Customer Name
              { type: "text", text: businessName }, // {{2}} - Business Name
              { type: "text", text: "Kumbakonam" }, // {{3}} - Location
              { type: "text", text: appointmentDate }, // {{4}} - Date
              { type: "text", text: appointmentTime }, // {{5}} - Time
              { type: "text", text: services }, // {{6}} - Services
              { type: "text", text: stylistName }, // {{7}} - Stylist Name
              { type: "text", text: "6380453804" }, // {{8}} - Phone Number
            ]
          }
        ]
      }
    };
    return this.sendMessage(message);
  }

  // BILLING CONFIRMATION - billing_ff template (10 parameters)
  async sendBillingConfirmation({
    phoneNumber,
    customerName,
    businessName = "FreshFace Unisex Salon",
    location = "Kumbakonam",
    servicesDetails,
    productsDetails,
    finalAmount,
    discountsApplied,
    paymentMethod,
    staffName,
    loyaltyPoints,
  }: {
    phoneNumber: string;
    customerName: string;
    businessName?: string;
    location?: string;
    servicesDetails: string;
    productsDetails: string;
    finalAmount: string;
    discountsApplied: string;
    paymentMethod: string;
    staffName: string;
    loyaltyPoints: string;
  }): Promise<boolean> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    // Ensure no empty strings AND no newlines - use safe defaults
    const safeServicesDetails = servicesDetails || 'Services completed';
    const safeProductsDetails = productsDetails || 'No products purchased';
    const safeDiscountsApplied = discountsApplied || 'No discounts applied';

    // Remove any newlines, tabs, or multiple spaces that might exist
    const cleanServicesDetails = safeServicesDetails.replace(/[\n\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const cleanProductsDetails = safeProductsDetails.replace(/[\n\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const cleanDiscountsApplied = safeDiscountsApplied.replace(/[\n\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();

    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: "billing_ff", // YOUR EXACT TEMPLATE NAME
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: customerName }, // {{1}} - Customer Name
              { type: "text", text: businessName }, // {{2}} - Business Name
              { type: "text", text: location }, // {{3}} - Location
              { type: "text", text: cleanServicesDetails }, // {{4}} - Services Details
              { type: "text", text: cleanProductsDetails }, // {{5}} - Products Details
              { type: "text", text: finalAmount }, // {{6}} - Final Amount
              { type: "text", text: cleanDiscountsApplied }, // {{7}} - Discounts Applied
              { type: "text", text: paymentMethod }, // {{8}} - Payment Method
              { type: "text", text: staffName }, // {{9}} - Staff Name
              { type: "text", text: loyaltyPoints }, // {{10}} - Loyalty Points
            ]
          }
        ]
      }
    };
    return this.sendMessage(message);
  }

  // APPOINTMENT REMINDER
  async sendAppointmentReminder({
    phoneNumber,
    customerName,
    appointmentDate,
    appointmentTime,
    services,
  }: {
    phoneNumber: string;
    customerName: string;
    appointmentDate: string;
    appointmentTime: string;
    services: string;
  }): Promise<boolean> {
    return this.sendAppointmentBooking({
      phoneNumber,
      customerName,
      appointmentDate,
      appointmentTime,
      services,
      stylistName: "Our Team",
    });
  }
}

export const whatsAppService = new WhatsAppService();