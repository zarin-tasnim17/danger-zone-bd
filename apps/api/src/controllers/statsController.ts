import { Request, Response, NextFunction } from 'express';
import * as statsService from '../services/statsService';

export const getStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await statsService.getPlatformStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
