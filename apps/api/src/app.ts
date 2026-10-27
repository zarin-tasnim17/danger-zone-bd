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
import mediaRouter from './routes/media';
import alertsRouter from './routes/alerts';
import adminRouter from './routes/admin';
import safeZonesRouter from './routes/safeZones';
import routingRouter from './routes/routing';

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/safe-zones', safeZonesRouter);
app.use('/api/v1/routes', routingRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'BD Safety Map API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      dbHealth: '/health/db',
      reports: '/api/v1/reports',
      safeZones: '/api/v1/safe-zones',
      safeRouting: '/api/v1/routes/safe-path',
      auth: '/api/v1/auth',
      media: '/api/v1/media',
      alerts: '/api/v1/alerts',
      admin: '/api/v1/admin'
    }
  });
});

app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// Global Error Handler
app.use(errorHandler);

export { app };
