import { Request, Response } from 'express';
import * as voteService from '../services/voteService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const voteOnReport = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: reportId } = req.params;
    const { voteType } = req.body; 

    const report = await voteService.submitVote(userId, reportId, voteType as 1 | -1);
    
    return successResponse(res, report, 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
