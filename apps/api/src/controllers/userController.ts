import { Request, Response } from 'express';
import * as userService from '../services/userService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id; // Authenticated by requireAuth
    const profile = await userService.getUserProfile(userId);
    return successResponse(res, profile, 200);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const submitVerify = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, documentUrl } = req.body;
    
    const verification = await userService.submitVerification(userId, type as any, documentUrl);
    
    return successResponse(res, verification, 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const approveVerify = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id; // Ensured by requireAuth and requireRole
    const { id: verificationId } = req.params;
    
    const updatedUser = await userService.approveVerification(adminId, verificationId);
    
    return successResponse(res, { userId: updatedUser.id, role: updatedUser.role }, 200);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
