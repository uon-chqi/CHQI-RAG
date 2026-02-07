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

    // Log index stats
    const stats = await pineconeIndex.describeIndexStats();
    console.log('✅ Pinecone initialized successfully');
    console.log(`📊 Index stats: ${stats.totalRecordCount || 0} records, dimension: ${stats.dimension || 'unknown'}`);
    
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

    if (!vectors || vectors.length === 0) {
      throw new Error('No vectors to upsert. Document may be empty or embeddings failed.');
    }

    const records = vectors.map((vec, idx) => ({
      id: vec.id || `chunk-${Date.now()}-${idx}`,
      values: vec.embedding,
      metadata: {
        text: vec.text.substring(0, 40000), // Pinecone metadata limit
        documentId: vec.documentId,
        documentTitle: vec.documentTitle,
        chunkIndex: vec.chunkIndex,
        ...vec.metadata,
      },
    }));

    console.log(`📤 Upserting ${records.length} vectors to Pinecone...`);
    console.log(`📏 Vector dimension: ${records[0]?.values?.length}`);

    // Batch upsert in chunks of 100 to avoid timeouts
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await pineconeIndex.upsert(batch);
      console.log(`✅ Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
    }

    console.log(`✅ Successfully upserted ${records.length} vectors to Pinecone`);
    return records.length;
  } catch (error) {
    console.error('❌ Error upserting vectors:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
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
