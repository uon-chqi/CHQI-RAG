import { query } from './server/config/database.js';

async function updateVectorDimension() {
  try {
    console.log('Updating vector dimension to 384...');
    
    // Drop existing index
    await query('DROP INDEX IF EXISTS idx_document_vectors_embedding');
    console.log('✅ Dropped old index');
    
    // Clear existing vectors FIRST (they're incompatible)
    await query('TRUNCATE document_vectors');
    console.log('✅ Cleared old vectors');
    
    // Alter column type
    await query('ALTER TABLE document_vectors ALTER COLUMN embedding TYPE vector(384)');
    console.log('✅ Updated embedding dimension to 384');
    
    // Recreate index
    await query('CREATE INDEX idx_document_vectors_embedding ON document_vectors USING hnsw (embedding vector_cosine_ops)');
    console.log('✅ Recreated index');
    
    // Reset documents
    await query("UPDATE documents SET status = 'processing', total_chunks = 0, processed_at = NULL WHERE status = 'completed'");
    console.log('✅ Reset document status');
    
    console.log('\n🎉 Database updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateVectorDimension();
