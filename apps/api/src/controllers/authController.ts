import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { verifyRefreshToken } from '../utils/jwt';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const loginDevice = async (req: Request, res: Response) => {
  try {
    const { anonymousId, email } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginOrRegisterDevice(anonymousId, email);

    // Set cookies
    res.cookie('accessToken', accessToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });

    return successResponse(res, { user: { id: user.id, role: user.role } }, 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new Error('No refresh token provided');

    const decoded = verifyRefreshToken(refreshToken);
    const { accessToken } = await authService.refreshSession(refreshToken, decoded.id);

    res.cookie('accessToken', accessToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });

    return successResponse(res, {}, 200);
  } catch (error: any) {
    return errorResponse(res, 'Unauthorized', 401);
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return successResponse(res, {}, 200);
  } catch (error: any) {
    return errorResponse(res, 'Internal server error', 500);
  }
};
