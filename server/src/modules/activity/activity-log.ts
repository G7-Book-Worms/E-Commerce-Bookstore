// Records who did what (SCRUM-190 shows these in the staff portal).
// Logging must never break the action it describes, so failures are only printed.
import { db } from '../../../db';
import { activityLog } from '../../../db/schema';

type Actor = 'customer' | 'admin' | 'system';

export async function logActivity(
  actorType: Actor,
  actorId: number | null,
  action: string,
  details?: Record<string, unknown>,
  ip?: string | null
) {
  try {
    await db.insert(activityLog).values({ actorType, actorId, action, details: details ?? null, ip: ip ?? null });
  } catch (err) {
    console.error('[activity-log] failed to record', action, err);
  }
}
