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

// Support multiple Gemini API keys for failover
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);
let currentGeminiIndex = 0;

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
  const hasContext = context && context.trim().length > 0;
  const systemPrompt = `You are a health assistant — a warm, friendly, and knowledgeable health companion for patients in an HIV care programme in Kenya.

YOUR IDENTITY:
- You are simply a "health assistant". Never reveal your name, the organisation behind you, or any brand/product name.
- If asked who you are, who made you, or who you work for, reply: "I'm a health assistant here to help you with your health questions."
- Do NOT mention any organisation, company, or system name under any circumstances.

YOUR PERSONALITY:
- Be conversational, empathetic, and human. Greet patients warmly when they greet you.
- Use simple, clear language any patient can understand.
- Keep responses concise (2-4 sentences) unless more detail is needed.
- You can engage in light conversation — respond naturally to greetings, pleasantries, and small talk.
- If a patient seems distressed, be compassionate and supportive.

MEDICAL KNOWLEDGE:
- When the patient asks a health or medical question, PRIORITISE information from the provided documents below.
- You may also draw on general, well-established medical knowledge about HIV/AIDS, antiretroviral therapy (ART), opportunistic infections, side effects, adherence, nutrition, mental health, and related topics to give helpful answers.
- If documents are provided and relevant, base your answer on them. If no documents are relevant but you have reliable general knowledge, use that instead of refusing to answer.
- Only say you cannot help if the question is truly outside your scope (e.g. legal advice, unrelated non-health topics).
- Always encourage patients to consult their healthcare provider for personalised medical advice.

APPOINTMENT RESCHEDULING:
- If the patient mentions wanting to reschedule, change, or move their appointment, respond with EXACTLY this text and nothing else:
  "I can help you reschedule your appointment. Please select your preferred date from the calendar below."
- Do NOT add any other text before or after that exact sentence when the patient asks about rescheduling.

SAFETY RULES:
- Never provide emergency medical advice — direct to emergency services (call 999 or go to the nearest hospital).
- Do NOT include citation numbers, reference numbers, or source markers like [1], [2], etc.
- ALWAYS complete your response fully. Never leave sentences unfinished.
- Use bullet points only when listing 3 or more items.

${hasContext ? `Context from medical documents:\n${context}` : 'No specific documents matched this query. Use your general health knowledge if relevant.'}

Patient message: ${prompt}

Respond naturally and helpfully:`;

  let lastError;
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const apiKey = GEMINI_KEYS[(currentGeminiIndex + i) % GEMINI_KEYS.length];
    try {
      console.log(`📤 Calling Gemini API with model: ${GEMINI_MODEL} using key #${(currentGeminiIndex + i) % GEMINI_KEYS.length + 1}`);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
            topP: 0.9
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
        } catch (e) {}
        // Only failover on quota/high demand errors
        if (
          errorMessage.includes('high demand') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('exceeded') ||
          errorMessage.includes('UNAVAILABLE') ||
          errorMessage.includes('rate limit')
        ) {
          lastError = errorMessage;
          continue; // Try next key
        }
        throw new Error(errorMessage);
      }
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from Gemini API');
      }
      const data = JSON.parse(responseText);
      if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
        console.error('❌ Unexpected response structure:', JSON.stringify(data, null, 2).substring(0, 500));
        throw new Error('Invalid response structure from Gemini API');
      }
      // Success: update currentGeminiIndex for round-robin
      currentGeminiIndex = (currentGeminiIndex + i) % GEMINI_KEYS.length;
      const result = data.candidates[0].content.parts[0].text;
      console.log(`✅ Generated response (${result.length} chars): ${result.substring(0, 100)}...`);
      return result;
    } catch (error) {
      lastError = error.message;
      console.error(`❌ Gemini key #${(currentGeminiIndex + i) % GEMINI_KEYS.length + 1} failed:`, error.message);
      // Try next key
    }
  }
  // All keys failed
  throw new Error(`All Gemini API keys failed. Last error: ${lastError}`);
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