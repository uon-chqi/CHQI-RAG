import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../config/database.js';
import { processDocument } from '../services/documentProcessor.js';
import { deleteVectorsByDocument } from '../services/pgvector.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  let documentId = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document title is required' 
      });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Only PDF and DOCX files are supported' 
      });
    }

    // Validate file size (50MB max)
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        error: 'File size must be less than 50MB' 
      });
    }

    console.log(`📤 Uploading document: ${title} (${req.file.originalname}, ${(req.file.size / (1024 * 1024)).toFixed(2)}MB)`);

    // Create document record
    const docResult = await query(
      `INSERT INTO documents (title, file_name, file_path, file_type, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        req.file.originalname,
        `/uploads/${req.file.originalname}`,
        req.file.mimetype,
        req.file.size,
        'processing'
      ]
    );

    const document = docResult.rows[0];
    documentId = document.id;

    console.log(`📝 Created document record with ID: ${documentId}`);

    // Return immediately with processing status
    res.json({
      success: true,
      message: 'Document uploaded successfully. Processing in background...',
      data: document,
    });

    // Process the document asynchronously with improved chunking
    processDocument(req.file, documentId, title.trim())
      .then(async (result) => {
        console.log(`\n✅ Document ${documentId} processing complete:`);
        console.log(`   - Total chunks: ${result.totalChunks}`);
        console.log(`   - Processed: ${result.processedChunks}`);
        console.log(`   - Failed: ${result.failedChunks}`);
        console.log(`   - Sample: ${result.sampleChunk}`);

        // Update document status to completed
        await query(
          `UPDATE documents
           SET status = $1, total_chunks = $2, processed_at = $3, metadata = $4
           WHERE id = $5`,
          [
            'completed',
            result.processedChunks,
            new Date().toISOString(),
            JSON.stringify({
              totalChunks: result.totalChunks,
              processedChunks: result.processedChunks,
              failedChunks: result.failedChunks,
              sampleChunk: result.sampleChunk,
            }),
            documentId
          ]
        );

        console.log(`💾 Updated document ${documentId} status to completed`);
      })
      .catch(async (error) => {
        console.error(`❌ Error processing document ${documentId}:`, error);
        
        // Update document status to error
        await query(
          `UPDATE documents
           SET status = $1, metadata = $2
           WHERE id = $3`,
          [
            'error',
            JSON.stringify({ 
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            }),
            documentId
          ]
        );

        console.log(`⚠️ Updated document ${documentId} status to error`);
      });

  } catch (error) {
    console.error('❌ Error uploading document:', error);
    
    // If document was created but processing failed, update status
    if (documentId) {
      try {
        await query(
          `UPDATE documents
           SET status = $1, metadata = $2
           WHERE id = $3`,
          [
            'error',
            JSON.stringify({ 
              error: error.message,
              phase: 'upload',
              timestamp: new Date().toISOString()
            }),
            documentId
          ]
        );
      } catch (updateError) {
        console.error('Error updating document status:', updateError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload document',
      details: error.message 
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, 
              COALESCE(COUNT(DISTINCT c.id), 0)::int as query_count
       FROM documents d
       LEFT JOIN conversations c ON c.citations::text LIKE '%' || d.id::text || '%'
       GROUP BY d.id
       ORDER BY d.uploaded_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Update document title (Edit)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log(`✏️ Updating document ${id} with title: ${title}`);

    // Check if document exists
    const checkResult = await query('SELECT * FROM documents WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      console.log(`⚠️ Document ${id} not found`);
      return res.status(404).json({ error: 'Document not found' });
    }

    // Update the document title
    const result = await query(
      'UPDATE documents SET title = $1 WHERE id = $2 RETURNING *',
      [title.trim(), id]
    );

    console.log(`✅ Document ${id} updated successfully`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ 
      error: 'Failed to update document',
      details: error.message 
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Attempting to delete document ${id}`);

    // First, check if document exists
    const checkResult = await query('SELECT * FROM documents WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      console.log(`⚠️ Document ${id} not found`);
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = checkResult.rows[0];

    // Delete associated file if it exists
    if (document.file_path) {
      try {
        const fullPath = path.resolve(document.file_path);
        await fs.unlink(fullPath);
        console.log(`✅ Deleted file: ${fullPath}`);
      } catch (fileError) {
        console.error(`⚠️ Error deleting file:`, fileError.message);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete vectors from pgvector
    try {
      await deleteVectorsByDocument(id);
      console.log(`✅ Deleted vectors for document ${id}`);
    } catch (vectorError) {
      console.error(`⚠️ Error deleting vectors:`, vectorError.message);
      // Continue with document deletion even if vector deletion fails
    }

    // Delete the document from database
    await query('DELETE FROM documents WHERE id = $1', [id]);
    console.log(`✅ Document ${id} deleted successfully from database`);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    res.status(500).json({ 
      error: 'Failed to delete document',
      details: error.message 
    });
  }
});

router.post('/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await query('UPDATE documents SET status = $1 WHERE id = $2', ['processing', id]);

    res.json({
      success: true,
      message: 'Document reprocessing started',
    });
  } catch (error) {
    console.error('Error reprocessing document:', error);
    res.status(500).json({ error: 'Failed to reprocess document' });
  }
});

export default router;
