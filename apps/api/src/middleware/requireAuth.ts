import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { errorResponse } from '../utils/responseFormatter';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies a JWT access token and validates against live database state
 * so suspended (`isBanned`) or deleted accounts are rejected immediately.
 */
export const verifyActiveAccessToken = async (token: string): Promise<JwtPayload> => {
  let decoded: JwtPayload;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw Object.assign(new Error('Unauthorized: Invalid or expired token'), { statusCode: 401 });
  }

  const account = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, role: true, isVerified: true, isBanned: true },
  });

  if (!account) {
    throw Object.assign(new Error('Unauthorized: Account not found'), { statusCode: 401 });
  }

  if (account.isBanned) {
    throw Object.assign(new Error('Forbidden: Account is suspended'), { statusCode: 403 });
  }

  return {
    id: account.id,
    role: account.role,
    isVerified: account.isVerified,
  };
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined);

  if (!token) {
    return errorResponse(res, 'Unauthorized: No access token provided', 401);
  }

  try {
    req.user = await verifyActiveAccessToken(token);
    return next();
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return errorResponse(res, error.message, error.statusCode);
    }
    return next(error);
  }
};
