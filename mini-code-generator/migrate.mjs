import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({
  filename: './database.sqlite', // MUST match server.js
  driver: sqlite3.Database
});

try {
  await db.run("ALTER TABLE users ADD COLUMN profile_pic TEXT");
  console.log("Migration successful: profile_pic column added");
} catch (err) {
  console.error("Migration error:", err);
}
