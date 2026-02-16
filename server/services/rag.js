import { generateEmbedding, generateResponse } from './gemini.js';
import { queryVectors } from './pgvector.js';
import { query } from '../config/database.js';

export const processQuery = async (message, phoneNumber, channel) => {
  const startTime = Date.now();

  try {
    console.log(`🔍 Processing query: "${message}"`);
    
    const queryEmbedding = await generateEmbedding(message);
    console.log(`✅ Generated query embedding: ${queryEmbedding.length} dimensions`);

    const relevantChunks = await queryVectors(queryEmbedding, 5);
    console.log(`📊 Found ${relevantChunks.length} relevant chunks`);
    
    if (relevantChunks.length > 0) {
      console.log(`   Top match score: ${relevantChunks[0].score}`);
      console.log(`   Preview: ${relevantChunks[0].metadata?.text?.substring(0, 100)}...`);
    }

    if (relevantChunks.length === 0) {
      return {
        response: "I don't have enough medical information to answer that question. Please consult a healthcare professional.",
        citations: [],
        responseTime: Date.now() - startTime,
      };
    }

    const context = relevantChunks
      .map((chunk, idx) => `[${idx + 1}] ${chunk.metadata.text} (Source: ${chunk.metadata.documentTitle || 'Medical Document'})`)
      .join('\n\n');

    const citations = relevantChunks.map((chunk, idx) => ({
      index: idx + 1,
      documentTitle: chunk.metadata.documentTitle || 'Medical Document',
      documentId: chunk.metadata.documentId,
      score: chunk.score,
      text: (chunk.metadata.text || '').substring(0, 100),
    }));

    let aiResponse = await generateResponse(message, context);

    // Remove any citation markers like [1], [2], [3] from the response
    aiResponse = aiResponse.replace(/\s*\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();

    // Ensure response ends with a complete sentence (not cut off mid-word)
    if (aiResponse && !aiResponse.match(/[.!?]\s*$/)) {
      // Find the last complete sentence
      const lastPeriod = aiResponse.lastIndexOf('.');
      const lastExclaim = aiResponse.lastIndexOf('!');
      const lastQuestion = aiResponse.lastIndexOf('?');
      const lastSentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);
      
      if (lastSentenceEnd > 0) {
        aiResponse = aiResponse.substring(0, lastSentenceEnd + 1);
      } else {
        // If no sentence ending found, add one
        aiResponse += '.';
      }
    }

    const responseTime = Date.now() - startTime;

    const result = await query(
      `INSERT INTO conversations (patient_phone, channel, message, response, citations, response_time_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [phoneNumber, channel, message, aiResponse, JSON.stringify(citations), responseTime, 'sent']
    );

    const conversation = result.rows[0];

    await updateSession(phoneNumber, channel);

    return {
      response: aiResponse,
      citations,
      responseTime,
      conversationId: conversation?.id,
    };
  } catch (error) {
    console.error('Error processing query:', error);

    await query(
      `INSERT INTO conversations (patient_phone, channel, message, status, error_message, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [phoneNumber, channel, message, 'error', error.message, Date.now() - startTime]
    );

    throw error;
  }
};

const updateSession = async (phoneNumber, channel) => {
  try {
    const result = await query(
      `SELECT * FROM sessions
       WHERE patient_phone = $1 AND channel = $2 AND expires_at > $3`,
      [phoneNumber, channel, new Date().toISOString()]
    );

    if (result.rows.length > 0) {
      const existingSession = result.rows[0];
      await query(
        `UPDATE sessions
         SET message_count = $1, last_message_at = $2, expires_at = $3
         WHERE id = $4`,
        [
          existingSession.message_count + 1,
          new Date().toISOString(),
          new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          existingSession.id,
        ]
      );
    } else {
      await query(
        `INSERT INTO sessions (patient_phone, channel, message_count, last_message_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [phoneNumber, channel, 1, new Date().toISOString(), new Date(Date.now() + 30 * 60 * 1000).toISOString()]
      );
    }
  } catch (error) {
    console.error('Error updating session:', error);
  }
};

export const checkRateLimit = async (phoneNumber, channel) => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const result = await query(
      'SELECT id FROM conversations WHERE patient_phone = $1 AND channel = $2 AND created_at >= $3',
      [phoneNumber, channel, oneMinuteAgo]
    );

    const count = result.rows.length;

    return {
      allowed: count < 5,
      count,
      limit: 5,
      resetIn: 60,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, count: 0, limit: 5 };
  }
};