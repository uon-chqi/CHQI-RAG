// find-working-model.js
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
console.log('Testing with key:', API_KEY?.substring(0, 15) + '...');

const modelsToTest = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-1.0-pro-001',
  'gemini-pro',  // might not work with v1
  'models/gemini-1.5-flash',
  'models/gemini-1.5-flash-001'
];

async function testModel(modelName) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hello' }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 20
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${modelName} WORKS: ${data.candidates[0].content.parts[0].text}`);
      return modelName;
    } else {
      const error = await response.json();
      console.log(`❌ ${modelName} failed: ${error.error.message.substring(0, 80)}`);
    }
  } catch (error) {
    console.log(`❌ ${modelName} error: ${error.message.substring(0, 80)}`);
  }
  
  return null;
}

async function findWorkingModel() {
  console.log('\n🔍 Testing models...');
  for (const model of modelsToTest) {
    const workingModel = await testModel(model);
    if (workingModel) {
      console.log(`\n🎉 Use this in your .env: GEMINI_CHAT_MODEL=${workingModel}`);
      return workingModel;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between tests
  }
  console.log('\n❌ No models worked with your API key/region');
}

findWorkingModel();
