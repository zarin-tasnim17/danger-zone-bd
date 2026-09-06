import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/health', healthRouter);

// Global Error Handler
app.use(errorHandler);

export { app };
