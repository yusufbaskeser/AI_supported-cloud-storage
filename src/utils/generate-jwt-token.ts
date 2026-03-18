    import * as jwt from 'jsonwebtoken';

    const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

    export function generateJwtToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '30d',
    });
    }