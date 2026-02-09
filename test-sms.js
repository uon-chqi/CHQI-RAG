import { sendSMS } from './server/services/sms.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSMS() {
  try {
    console.log('📱 Testing SMS with Africa\'s Talking...');
    console.log(`Username: ${process.env.AFRICASTALKING_USERNAME}`);
    console.log(`API Key: ${process.env.AFRICASTALKING_API_KEY?.substring(0, 10)}...`);
    
    // Replace with your phone number (must be in E.164 format: +254...)
    const testNumber = '+254712345678'; // CHANGE THIS!
    const testMessage = 'Hello from Healthcare RAG! This is a test message.';
    
    console.log(`\nSending to: ${testNumber}`);
    console.log(`Message: ${testMessage}\n`);
    
    const result = await sendSMS(testNumber, testMessage);
    
    console.log('\n✅ SMS Test Result:');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SMS Test Failed:');
    console.error(error);
    process.exit(1);
  }
}

testSMS();
