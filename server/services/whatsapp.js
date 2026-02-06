import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient = null;

export const initWhatsApp = () => {
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

export const sendWhatsApp = async (phoneNumber, message) => {
  try {
    const client = initWhatsApp();

    if (!phoneNumber.startsWith('whatsapp:')) {
      phoneNumber = `whatsapp:${phoneNumber}`;
    }

    const result = await client.messages.create({
      body: message,
      from: whatsappNumber,
      to: phoneNumber,
    });

    console.log('✅ WhatsApp message sent successfully:', result.sid);

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const client = initWhatsApp();
    const account = await client.api.accounts(accountSid).fetch();
    return { status: 'healthy', service: 'Twilio WhatsApp', accountStatus: account.status };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};
