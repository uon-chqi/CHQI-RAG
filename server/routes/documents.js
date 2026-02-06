import express from 'express';
import multer from 'multer';
import { query } from '../config/database.js';
import { processDocument } from '../services/documentProcessor.js';
import { deleteVectorsByDocument } from '../services/pinecone.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
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
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    const result = await query(
      `INSERT INTO documents (title, file_name, file_path, file_type, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, req.file.originalname, `/uploads/${req.file.originalname}`, req.file.mimetype, 'processing']
    );

    const document = result.rows[0];

    processDocument(req.file, document.id, title)
      .then(async (result) => {
        await query(
          `UPDATE documents
           SET status = $1, total_chunks = $2, processed_at = $3
           WHERE id = $4`,
          ['completed', result.totalChunks, new Date().toISOString(), document.id]
        );
        console.log(`✅ Document ${document.id} processed successfully`);
      })
      .catch(async (error) => {
        console.error('Error processing document:', error);
        await query(
          `UPDATE documents
           SET status = $1, metadata = $2
           WHERE id = $3`,
          ['error', JSON.stringify({ error: error.message }), document.id]
        );
      });

    res.json({
      success: true,
      message: 'Document uploaded and processing started',
      data: document,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM documents ORDER BY uploaded_at DESC'
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

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await deleteVectorsByDocument(id);

    await query('DELETE FROM documents WHERE id = $1', [id]);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
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
