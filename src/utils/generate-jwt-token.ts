import * as jwt from 'jsonwebtoken';

export function generateJwtToken(payload: object): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}
