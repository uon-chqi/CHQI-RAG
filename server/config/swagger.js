import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJSDoc from 'swagger-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CHQI RAG API',
      version: '1.0.0',
      description: 'API documentation for the CHQI RAG backend services.'
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Invalid token'
            }
          }
        }
      }
    }
  },
  apis: [path.join(__dirname, '../docs/openapi.js')]
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
