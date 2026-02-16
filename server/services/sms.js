import AfricasTalking from 'africastalking';
import dotenv from 'dotenv';

dotenv.config();

const credentials = {
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME,
};

let smsClient = null;

export const initSMS = () => {
  if (!smsClient) {
    const africastalking = AfricasTalking(credentials);
    smsClient = africastalking.SMS;
  }
  return smsClient;
};

export const sendSMS = async (phoneNumber, message) => {
  try {
    const client = initSMS();

    const options = {
      to: [phoneNumber],
      message: message,
      from: process.env.AFRICASTALKING_SHORTCODE, // Use your shortcode as sender
    };

    const result = await client.send(options);
    console.log('✅ SMS sent successfully:', result);

    return {
      success: true,
      messageId: result.SMSMessageData?.Recipients?.[0]?.messageId,
      status: result.SMSMessageData?.Recipients?.[0]?.status,
    };
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const client = initSMS();
    return { status: 'healthy', service: 'Africa\'s Talking SMS' };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};