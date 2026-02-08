// test-gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
console.log('API Key starts with:', process.env.GEMINI_API_KEY?.substring(0, 10) + '...');

async function testAPI() {
  try {
    // Test with v1 endpoint
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY,
      'https://generativelanguage.googleapis.com/v1/'
    );
    
    const model = genAI.getGenerativeModel({ model: 'models/gemini-pro' });
    
    console.log('Testing connection...');
    const result = await model.generateContent('Say hello');
    
    console.log('✅ Success! Response:', result.response.text());
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try direct fetch
    console.log('\nTrying direct fetch...');
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Say hello' }]
          }]
        })
      });
      
      console.log('Direct fetch status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Direct fetch works!');
        console.log('Response:', data.candidates[0].content.parts[0].text);
      } else {
        console.log('Response text:', await response.text());
      }
    } catch (fetchError) {
      console.error('Direct fetch also failed:', fetchError.message);
    }
    
    return false;
  }
}

testAPI();