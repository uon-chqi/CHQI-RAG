import { query } from '../config/database.js';

const EMBEDDING_DIMENSIONS = 768; // Gemini text-embedding-004

export const initPgVector = async () => {
  try {
    // Check if pgvector extension is enabled
    const result = await query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as enabled
    `);
    
    if (!result.rows[0].enabled) {
      throw new Error('pgvector extension is not enabled');
    }
    
    // Get table stats
    const stats = await query(`
      SELECT COUNT(*) as total_vectors,
             COUNT(DISTINCT document_id) as unique_documents
      FROM document_vectors
    `);
    
    console.log('📊 pgvector initialized:');
    console.log(`   └─ Total vectors: ${stats.rows[0].total_vectors}`);
    console.log(`   └─ Unique documents: ${stats.rows[0].unique_documents}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize pgvector:', error.message);
    throw error;
  }
};

export const upsertVectors = async (documentId, vectors) => {
  try {
    if (!vectors || vectors.length === 0) {
      console.warn('⚠️ No vectors to upsert');
      return { upsertedCount: 0 };
    }

    console.log(`📤 Upserting ${vectors.length} vectors for document ${documentId}...`);

    // Delete existing vectors for this document
    await query('DELETE FROM document_vectors WHERE document_id = $1', [documentId]);

    // Batch insert all vectors
    const batchSize = 100;
    let totalUpserted = 0;

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      
      // Build VALUES clause for batch insert
      const values = [];
      const params = [];
      let paramIndex = 1;

      batch.forEach((vector, idx) => {
        const actualIndex = i + idx;
        
        // Validate vector
        if (!vector.values || !Array.isArray(vector.values)) {
          console.warn(`⚠️ Skipping invalid vector at index ${actualIndex}`);
          return;
        }

        const embedding = `[${vector.values.join(',')}]`;
        const metadata = JSON.stringify(vector.metadata || {});
        
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
        params.push(documentId, actualIndex, vector.metadata?.text || '', embedding, metadata);
        paramIndex += 5;
      });

      if (values.length === 0) continue;

      const insertQuery = `
        INSERT INTO document_vectors (document_id, chunk_index, content, embedding, metadata)
        VALUES ${values.join(', ')}
      `;

      await query(insertQuery, params);
      totalUpserted += values.length;
      
      console.log(`   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} complete (${values.length} vectors)`);
    }

    console.log(`✅ Successfully upserted ${totalUpserted} vectors to PostgreSQL`);
    
    return { upsertedCount: totalUpserted };
  } catch (error) {
    console.error('❌ Error upserting vectors:', error);
    throw error;
  }
};

export const queryVectors = async (queryEmbedding, topK = 5, documentId = null) => {
  try {
    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      throw new Error('Invalid query embedding');
    }

    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    let sql = `
      SELECT 
        id,
        document_id,
        chunk_index,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM document_vectors
    `;
    
    const params = [embeddingString];
    
    if (documentId) {
      sql += ' WHERE document_id = $2';
      params.push(documentId);
    }
    
    sql += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(topK);

    const result = await query(sql, params);
    
    return result.rows.map(row => ({
      id: row.id,
      score: row.similarity,
      metadata: {
        ...row.metadata,
        text: row.content,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
      },
    }));
  } catch (error) {
    console.error('❌ Error querying vectors:', error);
    throw error;
  }
};

export const deleteVectorsByDocument = async (documentId) => {
  try {
    const result = await query(
      'DELETE FROM document_vectors WHERE document_id = $1',
      [documentId]
    );
    console.log(`🗑️ Deleted ${result.rowCount} vectors for document ${documentId}`);
    return { deletedCount: result.rowCount };
  } catch (error) {
    console.error('❌ Error deleting vectors:', error);
    throw error;
  }
};
