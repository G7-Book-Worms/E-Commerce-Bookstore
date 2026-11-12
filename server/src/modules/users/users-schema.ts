// Tables live in server/db/schema.ts (the single source of truth for the DB).
// This file re-exports them so module code can keep importing from here.
export { users, addresses, orders } from '../../../db/schema';
export type { User, NewUser, Address, NewAddress, Order } from '../../../db/schema';
