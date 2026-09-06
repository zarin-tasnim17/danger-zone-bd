import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(helmet());
app.use(cors({
  origin: corsOrigin,
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
app.use('/health', healthRouter);

// Global Error Handler
app.use(errorHandler);

export { app };
