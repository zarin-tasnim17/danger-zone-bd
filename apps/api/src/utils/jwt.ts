import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  id: string;
  role: string;
  isVerified: boolean;
}

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
};
