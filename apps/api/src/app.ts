import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';

const app = express();

const rawCors = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsOrigins = rawCors === '*' ? '*' : rawCors.split(',').map((o) => o.trim());

app.use(helmet());
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
import authRouter from './routes/auth';
import userRouter from './routes/users';
import reportRouter from './routes/reports';
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reports', reportRouter);
app.get('/', (req, res) => {
  res.json({
    name: 'BD Safety Map API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      dbHealth: '/health/db',
      reports: '/api/v1/reports',
      auth: '/api/v1/auth'
    }
  });
});

app.use('/health', healthRouter);

// Global Error Handler
app.use(errorHandler);

export { app };
