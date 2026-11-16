// server/src/modules/passkeys/passkey-handlers.ts
// The request/response side of passkey settings, shared by the customer routes (/api/passkeys)
// and the staff routes (/api/staff/passkeys). Who is asking is decided by the route.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpResponse } from '../../shared/http/api-response';
import type { MfaKind } from '../mfa/mfa-service';
import {
  PASSKEY_COOKIE, addPasskey, addPasskeySchema, listPasskeys, passkeyCookieOptions, registrationOptions,
  removePasskey, removePasskeySchema,
} from './passkey-service';

const stepSchema = z.object({ step: z.enum(['options', 'add']) }).passthrough();

/** GET: this account's passkeys */
export async function listHandler(kind: MfaKind, id: number) {
  return HttpResponse.success({ passkeys: await listPasskeys(kind, id) }, 'Passkeys');
}

/** POST { step: 'options' } then POST { step: 'add', response, name?, password } */
export async function addHandler(kind: MfaKind, id: number, req: NextRequest, ip: string | null): Promise<NextResponse> {
  const body = await req.json();
  const { step } = stepSchema.parse(body);
  if (step === 'options') {
    const { options, cookie } = await registrationOptions(kind, id, req.url);
    const res = HttpResponse.success({ options }, 'Follow the prompt on your device');
    res.cookies.set(PASSKEY_COOKIE, cookie, passkeyCookieOptions);
    return res;
  }
  const input = addPasskeySchema.parse(body);
  const { name } = await addPasskey(kind, id, input, req.cookies.get(PASSKEY_COOKIE)?.value, req.url, req.headers.get('user-agent'), ip);
  const res = HttpResponse.created({ name }, `Passkey added: ${name}`);
  res.cookies.set(PASSKEY_COOKIE, '', { ...passkeyCookieOptions, maxAge: 0 });
  return res;
}

/** DELETE /:id { password } */
export async function removeHandler(kind: MfaKind, id: number, passkeyId: string | undefined, req: NextRequest, ip: string | null) {
  const pid = Number(passkeyId);
  if (!Number.isInteger(pid) || pid <= 0) return HttpResponse.badRequest('Unknown passkey');
  const { password } = removePasskeySchema.parse(await req.json());
  await removePasskey(kind, id, pid, password, ip);
  return HttpResponse.success({}, 'Passkey removed');
}
