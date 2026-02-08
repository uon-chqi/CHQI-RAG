import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

let pineconeClient = null;
let pineconeIndex = null;

export const initPinecone = async () => {
  try {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    pineconeIndex = pineconeClient.index(process.env.PINECONE_INDEX_NAME || 'medical-documents');

    console.log('✅ Pinecone initialized successfully');
    return pineconeIndex;
  } catch (error) {
    console.error('❌ Error initializing Pinecone:', error);
    throw error;
  }
};

export const upsertVectors = async (vectors) => {
  try {
    if (!pineconeIndex) {
      await initPinecone();
    }

    const records = vectors.map((vec, idx) => ({
      id: vec.id || `chunk-${Date.now()}-${idx}`,
      values: vec.embedding,
      metadata: {
        text: vec.text,
        documentId: vec.documentId,
        documentTitle: vec.documentTitle,
        chunkIndex: vec.chunkIndex,
        ...vec.metadata,
      },
    }));

    await pineconeIndex.upsert(records);
    console.log(`✅ Upserted ${records.length} vectors to Pinecone`);
    return records.length;
  } catch (error) {
    console.error('❌ Error upserting vectors:', error);
    throw error;
  }
};

export const queryVectors = async (queryEmbedding, topK = 5, filter = {}) => {
  try {
    if (!pineconeIndex) {
      await initPinecone();
    }

    const queryRequest = {
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      ...(Object.keys(filter).length > 0 && { filter }),
    };

    const results = await pineconeIndex.query(queryRequest);

    return results.matches.map(match => ({
      score: match.score,
      text: match.metadata.text,
      documentId: match.metadata.documentId,
      documentTitle: match.metadata.documentTitle,
      chunkIndex: match.metadata.chunkIndex,
      metadata: match.metadata,
    }));
  } catch (error) {
    console.error('❌ Error querying vectors:', error);
    throw error;
  }
};

export const deleteVectorsByDocument = async (documentId) => {
  try {
    if (!pineconeIndex) {
      await initPinecone();
    }

    await pineconeIndex.deleteMany({
      filter: { documentId: { $eq: documentId } }
    });

    console.log(`✅ Deleted vectors for document: ${documentId}`);
  } catch (error) {
    console.error('❌ Error deleting vectors:', error);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    if (!pineconeIndex) {
      await initPinecone();
    }

    const stats = await pineconeIndex.describeIndexStats();
    return {
      status: 'healthy',
      totalVectors: stats.totalRecordCount || 0,
      dimension: stats.dimension || 768,
    };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};