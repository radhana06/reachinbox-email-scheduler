import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';

export interface AuthedRequest extends Request {
  userId?: number;
}

export const signToken = (userId: number) => jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '7d' });

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const payload = jwt.verify(req.cookies?.token, config.jwtSecret) as { uid: number };
    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
}
