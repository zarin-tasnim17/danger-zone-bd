import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  id: string;
  role: string;
  isVerified: boolean;
  tokenUse?: 'access' | 'socket';
}

export const generateAccessToken = (payload: Omit<JwtPayload, 'tokenUse'>): string => {
  return jwt.sign({ ...payload, tokenUse: 'access' }, env.JWT_SECRET, { expiresIn: '15m' });
};

export const generateSocketToken = (payload: Omit<JwtPayload, 'tokenUse'>): string => {
  return jwt.sign({ ...payload, tokenUse: 'socket' }, env.JWT_SECRET, { expiresIn: '15m' });
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
