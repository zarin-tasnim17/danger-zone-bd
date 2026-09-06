import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '@repo/shared';

const router = Router();
// Provide a centralized way to use Prisma in the real app, but for this health check we can initialize briefly or assume it's attached elsewhere later.
const prisma = new PrismaClient();

router.get('/', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'API is running'
  };
  res.json(response);
});

router.get('/db', async (req, res) => {
  try {
    // Attempt a lightweight query to check db health
    await prisma.$queryRaw`SELECT 1`;
    const response: ApiResponse = {
      success: true,
      message: 'Database connection successful'
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database connection failed'
      }
    };
    res.status(503).json(response);
  }
});

export default router;
