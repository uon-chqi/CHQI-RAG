import { CohereClient } from 'cohere-ai';
import dotenv from 'dotenv';
import { pipeline } from '@xenova/transformers';

dotenv.config();

// Setup multiple Cohere API keys for fallback
const cohereKeys = [
  process.env.COHERE_API_KEY,
  process.env.COHERE_API_KEY_2,
  process.env.COHERE_API_KEY_3,
].filter(key => key); // Remove undefined keys

const cohereClients = cohereKeys.map(key => new CohereClient({ token: key }));
let currentCohereIndex = 0;

// Use the model from .env or default to gemini-2.5-flash
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || 'models/gemini-2.5-flash';

// Initialize local embedding model (will download on first use)
let embeddingPipeline = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('🔧 Loading local embedding model (first time only)...');
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✅ Local embedding model loaded');
  }
  return embeddingPipeline;
}

console.log(`🔑 Using local embeddings (Xenova/all-MiniLM-L6-v2) and ${GEMINI_MODEL} for chat`);

export const generateEmbedding = async (text) => {
  try {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // Convert to regular array
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

export const generateResponse = async (prompt, context) => {
  try {
    const systemPrompt = `You are a helpful medical information assistant. Your role is to provide accurate, safe medical information based on the context provided.

IMPORTANT GUIDELINES:
1. Always base your answers on the provided medical documents
2. If the information is not in the context, say "I don't have enough information to answer that"
3. Always recommend consulting a healthcare professional for medical decisions
4. Never provide emergency medical advice - always direct to emergency services
5. Keep responses concise (under 160 characters when possible for SMS)
6. Include citation numbers [1], [2] for sources

Context from medical documents:
${context}

User question: ${prompt}

Provide a helpful, accurate response:`;

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    console.log(`📤 Calling Gemini API with model: ${GEMINI_MODEL}`);
    console.log(`📝 Context length: ${context.length} chars, Prompt length: ${systemPrompt.length} chars`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemPrompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          topP: 0.95
        }
      })
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      let errorText = await response.text();
      console.error('❌ Error response:', errorText.substring(0, 500));
      
      let errorMessage = `Gemini API error ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If can't parse JSON, use text as is
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    
    // Check if response is empty
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from Gemini API');
    }

    // Parse JSON
    const data = JSON.parse(responseText);
    
    // Validate response structure
    if (!data.candidates || 
        !Array.isArray(data.candidates) || 
        data.candidates.length === 0 ||
        !data.candidates[0].content ||
        !data.candidates[0].content.parts ||
        data.candidates[0].content.parts.length === 0) {
      console.error('❌ Unexpected response structure:', JSON.stringify(data, null, 2).substring(0, 500));
      throw new Error('Invalid response structure from Gemini API');
    }

    const result = data.candidates[0].content.parts[0].text;
    console.log(`✅ Generated response (${result.length} chars): ${result.substring(0, 100)}...`);
    
    return result;
  } catch (error) {
    console.error('❌ Error in generateResponse:', error.message);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return { status: 'down', error: 'GEMINI_API_KEY not set' };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'test' }] }],
        generationConfig: {
          maxOutputTokens: 10
        }
      })
    });

    const responseText = await response.text();
    
    if (response.ok) {
      return { status: 'healthy', responseTime: Date.now(), provider: 'Gemini' };
    } else {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // Ignore parse error
      }
      return { status: 'down', error: errorMessage };
    }
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};