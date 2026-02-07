-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop and recreate document_vectors table with 1024 dimensions for Cohere
DROP TABLE IF EXISTS document_vectors CASCADE;

CREATE TABLE document_vectors (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, chunk_index)
);

-- Create index for vector similarity search using HNSW (Hierarchical Navigable Small World)
CREATE INDEX document_vectors_embedding_idx 
ON document_vectors 
USING hnsw (embedding vector_cosine_ops);

-- Create index for document_id lookups
CREATE INDEX document_vectors_document_id_idx 
ON document_vectors(document_id);

-- Add comment
COMMENT ON TABLE document_vectors IS 'Stores document chunks and their vector embeddings for RAG similarity search';
