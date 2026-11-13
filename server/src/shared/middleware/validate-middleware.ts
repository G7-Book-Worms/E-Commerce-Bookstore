import { ZodSchema } from 'zod';
import { BadRequestError } from '../errors/app-error';

export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  try {
    const json = await req.json();
    return schema.parse(json);
  } catch (err: any) {
    throw new BadRequestError('Validation failed', err.errors || err.message);
  }
}