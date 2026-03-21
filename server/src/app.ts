import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

const app: Application = express();
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Serve static client files in production
if (isProduction) {
  const clientCandidates = [
    // Release package layout: Release/server/dist + ../client
    path.resolve(__dirname, '../client'),
    // Local production build layout: server/dist + ../../client/dist
    path.resolve(__dirname, '../../client/dist'),
    // Backward-compatible fallback for older release layouts
    path.resolve(__dirname, '../../client'),
  ];

  const clientPath = clientCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'index.html'))
  );

  if (clientPath) {
    app.use(express.static(clientPath));

    // Handle SPA routing - serve index.html for all non-API routes
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  } else {
    console.warn('Production client build not found. Checked:', clientCandidates);
  }
}

// 404 handler (only for API routes in production)
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
