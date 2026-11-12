import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { verifyRefreshToken } from '../utils/jwt';
import { extractAccessToken, verifyActiveAccessToken } from '../middleware/requireAuth';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/responseFormatter';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const getBaseCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
});

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const base = getBaseCookieOptions();
  res.cookie('accessToken', accessToken, { ...base, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refreshToken', refreshToken, { ...base, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
};

const clearAuthCookies = (res: Response) => {
  const base = getBaseCookieOptions();
  res.clearCookie('accessToken', base);
  res.clearCookie('refreshToken', base);
};

export const loginDevice = async (req: Request, res: Response) => {
  try {
    const { anonymousId, email } = req.body;
    const { user, accessToken, refreshToken, socketToken, isNewUser } =
      await authService.loginOrRegisterDevice(anonymousId, email);

    setAuthCookies(res, accessToken, refreshToken);

    return successResponse(
      res,
      { user: { id: user.id, role: user.role }, socketToken },
      isNewUser ? 201 : 200
    );
  } catch (error: any) {
    if (error?.statusCode === 403 && error?.message === 'Account is suspended') {
      clearAuthCookies(res);
    }
    return errorResponse(res, error.message, error.statusCode || 400);
  }
};

export const loginPassword = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken, socketToken } = await authService.loginWithPassword(email, password);

    setAuthCookies(res, accessToken, refreshToken);

    return successResponse(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          trustScore: user.trustScore,
        },
        socketToken,
      },
      200
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 401);
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new Error('No refresh token provided');

    const decoded = verifyRefreshToken(refreshToken);
    const {
      accessToken,
      refreshToken: rotatedRefreshToken,
      socketToken,
    } = await authService.refreshSession(refreshToken, decoded.id);

    setAuthCookies(res, accessToken, rotatedRefreshToken);

    return successResponse(res, { socketToken }, 200);
  } catch (error: any) {
    clearAuthCookies(res);
    return errorResponse(res, 'Unauthorized', 401);
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const accessToken = extractAccessToken(req);
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    let hasValidSession = false;

    if (accessToken) {
      try {
        await verifyActiveAccessToken(accessToken);
        hasValidSession = true;
      } catch {
        // Fall through to refreshToken verification so expired access tokens can still log out cleanly
      }
    }

    if (!hasValidSession && refreshToken) {
      try {
        verifyRefreshToken(refreshToken);
        hasValidSession = true;
      } catch {
        // Invalid or expired refresh token
      }
    }

    if (!hasValidSession) {
      return errorResponse(res, 'Unauthorized: No valid session token provided', 401);
    }

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    clearAuthCookies(res);
    return successResponse(res, {}, 200);
  } catch (error: any) {
    return errorResponse(res, 'Internal server error', 500);
  }
};
