// index.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const pool = mysql.createPool({ 
  uri: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized:false}});

export const db = drizzle({ client: pool, schema, mode: "default" });