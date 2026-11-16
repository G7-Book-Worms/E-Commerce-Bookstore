import { ZodSchema } from 'zod';
import { BadRequestError } from '../errors/app-error';

export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  try {
    const json = await req.json();
    return schema.parse(json);
  } catch (err: unknown) {
    const e = err as { errors?: unknown; message?: string };
    throw new BadRequestError('Validation failed', e.errors || e.message);
  }
}