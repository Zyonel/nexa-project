// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
const dbPath = path.resolve("database.db"); // resolves relative to current working directory
console.log("DB path:", dbPath);
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// Helper functions to safely load/save JSON (kept for compatibility)
function loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Error reading JSON file:", filePath, err);
    return [];
  }
}
function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing JSON file:", filePath, err);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const cors = require('cors');
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.error("Could not create uploads directory:", e);
}

const USERS_FILE = path.join(__dirname, "data", "users.json");
const TASKS_FILE = path.join(__dirname, "data", "tasks.json");

// multer storage (uses __dirname above)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);

  },
filename: (req, file, cb) => {
  const uniqueName = uuidv4() + "-" + file.originalname.replace(/\s+/g, "_");
  cb(null, uniqueName);
},

});
const upload = multer({ storage });

// static folders
app.use("/public", express.static(path.join(__dirname, "/public")));
app.use("/", express.static(path.join(__dirname, "../SIMON")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ADMIN AUTH MIDDLEWARE
function adminAuth(req, res, next) {
  const pass = req.headers["x-admin-pass"];
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ success: false, message: "Admin password not configured" });
  }
  if (!pass || pass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized (admin)" });
  }
  next();
}

// NODEMAILER TRANSPORTER (GMAIL)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// DATABASE INITIALIZATION
const db = await open({
  filename: "./database.sqlite",
  driver: sqlite3.Database,
});

// Create necessary tables
await db.exec(`
CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  created_at INTEGER,
  expires_at INTEGER,
  used INTEGER DEFAULT 0
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname TEXT,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  password TEXT,
  country TEXT,
  phone TEXT,
  created_at INTEGER,
  total_balance REAL DEFAULT 0,
  affiliate_balance REAL DEFAULT 0,
  bonus_balance REAL DEFAULT 0
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  amount REAL,
  bank_name TEXT,
  account_number TEXT,
  status TEXT DEFAULT 'pending',
  requested_at INTEGER
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  type TEXT,
  amount REAL,
  balance_after REAL,
  note TEXT,
  created_at INTEGER
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS wallet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  amount REAL,
  type TEXT,
  description TEXT,
  change REAL,
  reason TEXT,
  created_at INTEGER
);
`);

// VIDEOS table (add redirect_url if missing)
await db.exec(`
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  url TEXT,
  reward REAL DEFAULT 0,
  created_at INTEGER
);
`);

// Ensure redirect_url column exists (safe ALTER)
const cols = await db.all("PRAGMA table_info('videos')");
const hasRedirect = cols.some((c) => c.name === "redirect_url");
if (!hasRedirect) {
  try {
    await db.exec(`ALTER TABLE videos ADD COLUMN redirect_url TEXT`);
    console.log("Added missing column: videos.redirect_url");
  } catch (err) {
    console.warn("Could not add redirect_url column:", err);
  }
}

await db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  description TEXT,
  reward REAL DEFAULT 0,
  created_at INTEGER
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS watch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  video_id INTEGER,
  rewarded INTEGER DEFAULT 0,
  created_at INTEGER
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  task_id INTEGER,
  completed INTEGER DEFAULT 0,
  created_at INTEGER
);
`);

// Database file for articles
const ARTICLES_DB = "./articles.json";
expires_at: Date.now() + 24 * 60 * 60 * 1000   // 24 hours

// Ensure DB file exists
if (!fs.existsSync(ARTICLES_DB)) {
  fs.writeFileSync(ARTICLES_DB, JSON.stringify([]));
}

// Ensure redirect_url column exists for tasks (safe ALTER)
const taskCols = await db.all("PRAGMA table_info('tasks')");
const hasTaskRedirect = taskCols.some((c) => c.name === "redirect_url");
if (!hasTaskRedirect) {
  try {
    await db.exec(`ALTER TABLE tasks ADD COLUMN redirect_url TEXT`);
    console.log("Added missing column: tasks.redirect_url");
  } catch (err) {
    console.warn("Could not add tasks.redirect_url column:", err);
  }
}

// HELPER FUNCTIONS
function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function sendEmail(to, subject, html) {
  return transporter.sendMail({
    from: `"Nexa Admin" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

/*****************************************************
 * CODE GENERATOR (ADMIN)
 *****************************************************/
app.post("/api/generate", async (req, res) => {
  try {
    const length = parseInt(req.body.length) || 6;
    const code = generateCode(length);
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hrs

    await db.run("INSERT INTO codes (code, created_at, expires_at) VALUES (?, ?, ?)", [
      code,
      now,
      expiresAt,
    ]);

    res.json({ code, expiresAt });
  } catch (err) {
    console.error("Code generation error:", err);
    res.status(500).json({ success: false, message: "Database error while generating code" });
  }
});

app.get("/api/list", async (req, res) => {
  const rows = await db.all("SELECT * FROM codes ORDER BY id DESC");
  res.json(rows);
});

app.delete("/api/cleanup", async (req, res) => {
  const now = Date.now();
  await db.run("DELETE FROM codes WHERE expires_at < ? OR used = 1", [now]);
  res.json({ ok: true });
});

// NOTE: verify only checks validity and DOES NOT mark code used
app.post("/api/verify", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ valid: false, reason: "missing_code" });

  const row = await db.get("SELECT * FROM codes WHERE code = ?", [code]);
  if (!row) return res.json({ valid: false, reason: "not_found" });
  if (Date.now() > row.expires_at) return res.json({ valid: false, reason: "expired" });
  if (row.used) return res.json({ valid: false, reason: "already_used" });

  return res.json({ valid: true });
});

/*****************************************************
 * USER AUTHENTICATION + REFERRALS
 *****************************************************/
app.post("/api/signup", async (req, res) => {
  const { fullname, email, username, password, country, phone, code, ref } = req.body;
  if (!fullname || !email || !username || !password || !code)
    return res.status(400).json({ error: "Missing required fields" });

  const codeRow = await db.get("SELECT * FROM codes WHERE code = ?", [code]);
  if (!codeRow) return res.json({ success: false, message: "Invalid access code" });
  if (Date.now() > codeRow.expires_at) return res.json({ success: false, message: "Access code expired" });
  if (codeRow.used) return res.json({ success: false, message: "Access code already used" });

  const hashed = await bcrypt.hash(password, 10);

  try {
    await db.run(
  "INSERT INTO users (fullname, email, username, password, country, phone, created_at, total_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  [fullname, email, username, hashed, country, phone, Date.now(), 750]
);


    await db.run("UPDATE codes SET used = 1 WHERE id = ?", [codeRow.id]);

    if (ref) {
      try {
        const refUser = await db.get(
          "SELECT username, total_balance, affiliate_balance, email FROM users WHERE LOWER(username) = LOWER(?)",
          [ref]
        );

        if (refUser) {
          const prevTotal = Number(refUser.total_balance || 0);
          const prevAffiliate = Number(refUser.affiliate_balance || 0);
          const reward = 6000;

          const newTotal = prevTotal + reward;
          const newAffiliate = prevAffiliate + reward;

          await db.run(
            "UPDATE users SET total_balance = ?, affiliate_balance = ? WHERE username = ?",
            [newTotal, newAffiliate, ref]
          );

          await db.run(
            "INSERT INTO transactions (username, type, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [ref, "referral_bonus", reward, newTotal, `Referral bonus from ${username}`, Date.now()]
          );

          await db.run(
            "INSERT INTO wallet_logs (username, amount, type, description, change, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [ref, reward, "credit", `Referral bonus for inviting ${username}`, reward, `referral:${username}`, Date.now()]
          );

          if (refUser.email) {
            const subject = "🎉 You earned a referral bonus!";
            const html = `
              <p>Hello ${refUser.username},</p>
              <p>Good news — you received ₦${reward.toLocaleString()} as a referral bonus because <strong>${username}</strong> signed up using your link.</p>
              <p>Your new balance is ₦${newTotal.toFixed(2)}.</p>
              <p>Thanks for referring a user!</p>
            `;
            sendEmail(refUser.email, subject, html).catch(err => console.error("Referral email error:", err));
          }
        }
      } catch (refErr) {
        console.error("Referral processing error:", refErr);
      }
    }

    res.json({ success: true, message: "User registered successfully!" });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
      res.json({ success: false, message: "Email or username already exists" });
    } else {
      console.error("Signup error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "Missing credentials" });

  const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
  if (!user) return res.json({ success: false, message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: "Invalid password" });

  res.json({
    success: true,
    message: "Login successful",
    user: {
      id: user.id,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      country: user.country,
      total_balance: user.total_balance || 0,
    affiliate_balance: user.affiliate_balance || 0,
    bonus_balance: user.bonus_balance || 0
    },
  });
});

app.post("/api/user/edit", upload.single("profile_pic"), async (req, res) => {
  try {
    const { username, fullname, email, country, phone, password, newUsername } = req.body;
    if (!username) return res.status(400).json({ success: false, message: "Missing username" });

    const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const updates = [];
    const params = [];

    if (fullname) { updates.push("fullname = ?"); params.push(fullname); }
    if (email) { updates.push("email = ?"); params.push(email); }
    if (country) { updates.push("country = ?"); params.push(country); }
    if (phone) { updates.push("phone = ?"); params.push(phone); }
    if (password) { 
      const hashed = await bcrypt.hash(password, 10);
      updates.push("password = ?"); 
      params.push(hashed); 
    }
    if (newUsername) { updates.push("username = ?"); params.push(newUsername); }
    if (req.file) {
      if (user.profile_pic && fs.existsSync(path.join(__dirname, user.profile_pic))) {
        fs.unlinkSync(path.join(__dirname, user.profile_pic));
      }
      updates.push("profile_pic = ?");
      params.push("/uploads/" + req.file.filename);
    }

    if (updates.length === 0) return res.status(400).json({ success: false, message: "No fields to update" });

    params.push(username);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE username = ?`;
    await db.run(sql, params);

    const updatedUser = await db.get(
      "SELECT id, fullname, username, email, country, phone, profile_pic FROM users WHERE username = ?",
      [newUsername || username]
    );

    res.json({ success: true, message: "Profile updated", user: updatedUser });
  } catch (err) {
    console.error("Edit profile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
/*****************************************************
 * USER WALLET & WITHDRAWALS
 *****************************************************/
app.get("/api/user/:username", async (req, res) => {
  const { username } = req.params;
  const user = await db.get("SELECT fullname, email, country, phone, created_at FROM users WHERE username = ?", [username]);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, user });
});

app.get("/api/wallet/:username", async (req, res) => {
  const { username } = req.params;
  const wallet = await db.get("SELECT total_balance, affiliate_balance, bonus_balance FROM users WHERE username = ?", [username]);
  if (!wallet) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, wallet });
});

app.post("/api/withdraw", async (req, res) => {
  try {
    const { username, amount, bank_name, account_number } = req.body;
    if (!username || !amount || !bank_name || !account_number) return res.status(400).json({ success: false, message: "Missing fields" });

    const user = await db.get("SELECT total_balance, email FROM users WHERE username = ?", [username]);
    if (!user) return res.json({ success: false, message: "User not found" });

    if (amount > user.total_balance) return res.json({ success: false, message: "Insufficient balance" });

    const newBalance = user.total_balance - amount;
    await db.run("UPDATE users SET total_balance = ? WHERE username = ?", [newBalance, username]);

    await db.run("INSERT INTO withdrawals (username, amount, bank_name, account_number, requested_at) VALUES (?, ?, ?, ?, ?)",
      [username, amount, bank_name, account_number, Date.now()]);

    await db.run("INSERT INTO transactions (username, type, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [username, "withdraw_request", -amount, newBalance, "User withdrawal requested", Date.now()]);

    await db.run("INSERT INTO wallet_logs (username, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?)",
      [username, -amount, "debit", "Withdrawal request submitted", Date.now()]);

    res.json({ success: true, message: "Withdrawal request submitted successfully!" });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/*****************************************************
 * ADMIN WITHDRAWAL MANAGEMENT
 *****************************************************/
app.get("/api/admin/withdrawals", adminAuth, async (req, res) => {
  const status = req.query.status;
  const rows = status
    ? await db.all("SELECT * FROM withdrawals WHERE status = ? ORDER BY requested_at DESC", [status])
    : await db.all("SELECT * FROM withdrawals ORDER BY requested_at DESC");
  res.json({ success: true, withdrawals: rows });
});

app.post("/api/admin/withdrawals/update", adminAuth, async (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id || !status) return res.json({ success: false, message: "Missing data" });

    const w = await db.get("SELECT * FROM withdrawals WHERE id = ?", [id]);
    if (!w) return res.json({ success: false, message: "Withdrawal not found" });

    await db.run("UPDATE withdrawals SET status = ? WHERE id = ?", [status, id]);

    const user = await db.get("SELECT email, fullname FROM users WHERE username = ?", [w.username]);
    if (user && user.email) {
      const subject = `Withdrawal Request #${id} ${status}`;
      const html = `
        <div>
          <p>Hello ${user.fullname || w.username},</p>
          <p>Your withdrawal request of ₦${Number(w.amount).toFixed(2)} has been <strong>${status}</strong>.</p>
          <p>Bank: ${w.bank_name} — Account: ${w.account_number}</p>
          <p>Thank you.</p>
        </div>
      `;
      sendEmail(user.email, subject, html).catch(err => console.error("Email error:", err));
    }

    await db.run("INSERT INTO transactions (username, type, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [w.username, `withdraw_${status}`, 0, null, `Withdrawal ${status}`, Date.now()]);

    res.json({ success: true, message: `Withdrawal ${status}` });
  } catch (err) {
    console.error("Admin update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/*****************************************************
 * USER TRANSACTION HISTORY & WALLET LOGS
 *****************************************************/
app.get("/api/transactions/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const withdrawals = await db.all(
      "SELECT id, amount, status, requested_at AS date, 'Withdrawal' AS type FROM withdrawals WHERE username = ? ORDER BY requested_at DESC",
      [username]
    );

    const walletLogs = await db.all(
      "SELECT id, amount, type, description, created_at AS date FROM wallet_logs WHERE username = ? ORDER BY created_at DESC",
      [username]
    );

    res.json({
      success: true,
      transactions: [...withdrawals, ...walletLogs].sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/wallet/logs/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const logs = await db.all("SELECT id, amount, type, description, created_at FROM wallet_logs WHERE username = ? ORDER BY created_at DESC", [username]);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Error fetching wallet logs:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/*****************************************************
 * ADMIN: Videos CRUD (with redirect support)
 *
 * Admin can:
 *  - POST /api/admin/videos with multipart/form-data:
 *      fields: title, reward
 *      file: video (optional if url provided)
 *      redirect (optional) -> saved to redirect_url column (secret)
 *    or send JSON { title, url, reward, redirect } (no file)
 *
 * /api/admin/videos (GET) returns full rows (admin-only),
 * but /api/videos (public) will NOT expose redirect_url.
 *****************************************************/
app.post("/api/admin/videos", adminAuth, upload.single("video"), async (req, res) => {
  try {
    const { title, reward } = req.body;
    // admin may submit redirect URL as `redirect` or `redirect_url`
    let redirect = req.body.redirect || req.body.redirect_url || null;
    let url = req.body.url || null; // optional (external playback link)
    const file = req.file;

    if (!title || (typeof reward === "undefined") || (!url && !file && !redirect)) {
      // we allow redirect-only if admin wants a redirect (but ensure at least file/url/redirect exists)
      return res.status(400).json({ success: false, message: "Missing fields (title, reward and either url/video file/redirect required)" });
    }

    if (file) {
      // store relative path accessible from browser
      url = `/uploads/${file.filename}`;
    }

    // insert: store redirect_url (if any) in DB but do not expose it publically
    await db.run(
      "INSERT INTO videos (title, url, reward, redirect_url, created_at) VALUES (?, ?, ?, ?, ?)",
      [title, url || "", Number(reward), redirect || null, Date.now()]
    );

    res.json({ success: true, message: "Video added successfully!", videoUrl: url, redirectProvided: !!redirect });
  } catch (err) {
    console.error("Add video error:", err);
    res.status(500).json({ success: false, message: "Server error while uploading video" });
  }
});

app.get("/api/videos", async (req, res) => {
  try {
    // Include redirect_url but rename it to redirect for frontend use
    const rows = await db.all(`
      SELECT id, title, url, reward, redirect_url AS redirect, created_at
      FROM videos
      ORDER BY id DESC
    `);
    res.json({ success: true, videos: rows });
  } catch (err) {
    console.error("Error fetching videos:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/admin/videos/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // fetch to delete local file if any
    const video = await db.get("SELECT * FROM videos WHERE id = ?", [id]);
    if (video && video.url && video.url.startsWith("/uploads/")) {
      const filepath = path.join(__dirname, video.url.replace(/^\//, ""));
      try {
        await fs.promises.unlink(filepath).catch(() => {});
      } catch (e) {
        console.warn("Could not delete file:", filepath, e);
      }
    }

    await db.run("DELETE FROM videos WHERE id = ?", [id]);
    res.json({ success: true, message: "Video deleted" });
  } catch (err) {
    console.error("Delete video error:", err);
    res.status(500).json({ success: false, message: "Server error deleting video" });
  }
});

/*****************************************************
 * Automatic cleanup: remove videos older than 24 hours
 * - deletes DB record
 * - deletes local file (if URL starts with /uploads/)
 * Runs every hour (and once immediately at start)
 *****************************************************/
async function cleanupOldVideos() {
  try {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - DAY_MS;

    // find old videos
    const old = await db.all("SELECT * FROM videos WHERE created_at < ?", [cutoff]);
    if (!old || old.length === 0) return;

    for (const v of old) {
      // delete file if it's a local upload
      if (v.url && typeof v.url === "string" && v.url.startsWith("/uploads/")) {
        const filepath = path.join(__dirname, v.url.replace(/^\//, ""));
        try {
          await fs.promises.unlink(filepath);
          console.log(`Deleted file ${filepath}`);
        } catch (err) {
          // not fatal — log and continue
          console.warn("Could not delete file:", filepath, err.message || err);
        }
      }

      // delete DB row
      await db.run("DELETE FROM videos WHERE id = ?", [v.id]);
      console.log(`Removed expired video id=${v.id} (${v.title})`);
    }
  } catch (err) {
    console.error("Error cleaning up old videos:", err);
  }
}

// run once at start
cleanupOldVideos();
// schedule hourly
setInterval(cleanupOldVideos, 60 * 60 * 1000);

/*****************************************************
 * PUBLIC: List videos (no redirect_url exposed)
 *****************************************************/
app.get("/api/videos", async (req, res) => {
  try {
    // Return redirect_url as redirect so frontend can use it
    const rows = await db.all(`
      SELECT id, title, url, reward, redirect_url AS redirect, created_at 
      FROM videos 
      ORDER BY id DESC
    `);

    res.json({ success: true, videos: rows });
  } catch (err) {
    console.error("Error fetching videos:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/**
 * Claim watch reward.
 * Body: { username, video_id }
 * (existing flow — unchanged)
 */
app.post("/api/videos/claim", async (req, res) => {
  try {
    const { username, video_id } = req.body;
    if (!username || !video_id) return res.status(400).json({ success: false, message: "Missing fields" });

    const existing = await db.get("SELECT * FROM watch_logs WHERE username = ? AND video_id = ?", [username, video_id]);
    if (existing && existing.rewarded) {
      return res.json({ success: false, message: "Already rewarded for this video" });
    }

    const video = await db.get("SELECT * FROM videos WHERE id = ?", [video_id]);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    const user = await db.get("SELECT total_balance FROM users WHERE username = ?", [username]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const reward = Number(video.reward) || 0;
    const newBalance = Number(user.total_balance || 0) + reward;

    await db.run("UPDATE users SET total_balance = ? WHERE username = ?", [newBalance, username]);

    if (existing) {
      await db.run("UPDATE watch_logs SET rewarded = 1 WHERE id = ?", [existing.id]);
    } else {
      await db.run("INSERT INTO watch_logs (username, video_id, rewarded, created_at) VALUES (?, ?, ?, ?)",
        [username, video_id, 1, Date.now()]);
    }

    await db.run("INSERT INTO transactions (username, type, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [username, "watch_reward", reward, newBalance, `Watched video: ${video.title}`, Date.now()]);

    await db.run("INSERT INTO wallet_logs (username, amount, type, description, change, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, reward, "credit", `Watch reward for video: ${video.title}`, reward, `watch:${video_id}`, Date.now()]);

    res.json({ success: true, message: "Reward credited", reward, balance: newBalance });
  } catch (err) {
    console.error("Claim video error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/*****************************************************
 * NEW: Redirect route that opens external link and then auto-claims
 *
 * Flow (frontend):
 *  - When user clicks "Claim and Visit", frontend should navigate to:
 *      /r/:videoId?username=XYZ
 *  - This page will:
 *      1) open external redirect_url in new tab/window
 *      2) POST to /api/videos/claim to credit reward
 *      3) show status and close automatically (or let user close)
 *
 * Note: redirect_url is kept secret in DB and NOT returned by /api/videos
 *****************************************************/
app.get("/r/:videoId", async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const username = req.query.username || "";
    if (!videoId) return res.status(400).send("Missing video id");

    // fetch video and redirect_url
    const video = await db.get("SELECT id, title, url, reward, redirect_url FROM videos WHERE id = ?", [videoId]);
    if (!video) return res.status(404).send("Video not found");

    // choose where to redirect:
    // - prefer redirect_url if present (admin-provided secret)
    // - otherwise fall back to video.url (if it's an external link)
    const redirectTarget = (video.redirect_url && String(video.redirect_url).trim()) || (video.url && String(video.url).trim()) || null;

    // Build a small HTML page that performs the sequence:
    // - open redirectTarget in a new tab/window
    // - call POST /api/videos/claim with username & video_id (in background)
    // - display status and close after a short delay
    const safeRedirect = redirectTarget ? redirectTarget.replace(/"/g, '&quot;') : "";
    const safeUsername = String(username).replace(/"/g, '&quot;');
    const safeVideoId = String(videoId).replace(/"/g, '&quot;');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Opening link...</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;background:#f7fafc;color:#111}
    .card{max-width:600px;text-align:center;padding:20px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.08);background:#fff}
    .muted{color:#666;margin-top:8px;font-size:14px}
    .status{margin-top:16px;font-weight:600}
    .small{font-size:13px;color:#444;margin-top:8px}
    button{margin-top:14px;padding:8px 14px;border-radius:8px;border:0;background:#2b6cb0;color:#fff;cursor:pointer}
  </style>
</head>
<body>
  <div class="card">
    <div>
      <div>Opening external link...</div>
      <div class="muted">You will be taken to an external site. We will credit your watch reward automatically.</div>
      <div class="status" id="status">Processing...</div>
      <div class="small" id="detail"></div>
      <div>
        <button id="closeBtn" style="display:none">Close</button>
      </div>
    </div>
  </div>

  <script>
    (function(){
      const redirect = "${safeRedirect}";
      const username = "${safeUsername}";
      const videoId = "${safeVideoId}";
      const statusEl = document.getElementById('status');
      const detailEl = document.getElementById('detail');
      const closeBtn = document.getElementById('closeBtn');

      function safeOpen(url){
        try {
          // open in a new tab/window
          const win = window.open(url, '_blank');
          if(!win){
            // popup blocked, try replacing current location
            window.location.href = url;
            return false;
          }
          return true;
        } catch(e){
          return false;
        }
      }

      async function claimReward(){
        if(!username){
          statusEl.textContent = "No username provided — reward not claimed.";
          detailEl.textContent = "Please pass ?username=YOUR_USERNAME to this URL.";
          closeBtn.style.display = 'inline-block';
          return;
        }

        try {
          const res = await fetch('/api/videos/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, video_id: videoId })
          });
          const j = await res.json();
          if(j && j.success){
            statusEl.textContent = "✅ Reward credited!";
            detailEl.textContent = "Amount: ₦" + (j.reward != null ? Number(j.reward).toString() : "0");
          } else {
            statusEl.textContent = "ℹ️ " + (j && j.message ? j.message : "Claim response received");
            detailEl.textContent = JSON.stringify(j || {});
          }
        } catch(err){
          console.error('Claim error', err);
          statusEl.textContent = "⚠️ Could not contact server to claim reward.";
          detailEl.textContent = String(err);
        } finally {
          closeBtn.style.display = 'inline-block';
        }
      }

      // sequence:
      // 1) open redirect (if any) in new tab
      // 2) then attempt claim in background
      if(redirect){
        const opened = safeOpen(redirect);
        // try to claim reward after attempting redirect
        claimReward();
        // give user control to close page
        // if popup blocked and we navigated, claimReward is still running (may be killed if navigation happened)
      } else {
        // no redirect target — still claim reward and show message
        claimReward();
      }

      closeBtn.addEventListener('click', function(){
        window.close();
      });

      // auto close after 6s so page is not left open (user can override by clicking Close)
      setTimeout(()=> {
        try { window.close(); } catch(e) {}
      }, 6000);
    })();
  </script>
</body>
</html>
`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("/r/:videoId error:", err);
    res.status(500).send("Server error");
  }
});

/*****************************************************
 * TASKS: admin add / public list / complete
 *****************************************************/
app.post("/api/admin/tasks", adminAuth, async (req, res) => {
  try {
    const { title, description, reward, redirect } = req.body;

    if (!title || typeof reward === "undefined") {
      return res.status(400).json({ success: false, message: "Title and reward are required." });
    }

    // Insert into SQLite tasks table
    const createdAt = Date.now();
    const result = await db.run(
      "INSERT INTO tasks (title, description, reward, redirect_url, created_at) VALUES (?, ?, ?, ?, ?)",
      [title, description || "", Number(reward), redirect || null, createdAt]
    );

    const insertedId = result.lastID || null;

    // Also keep a tasks.json copy for legacy (create data folder if missing)
    const dataDir = path.join(__dirname, "data");
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const tasksFile = path.join(dataDir, "tasks.json");

      let tasks = [];
      if (fs.existsSync(tasksFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
          tasks = content.tasks || [];
        } catch (err) {
          console.warn("Could not parse existing tasks.json, overwriting", err);
          tasks = [];
        }
      }

      const newTask = {
        id: insertedId ? String(insertedId) : Date.now().toString(),
        title,
        description: description || "",
        reward: Number(reward),
        redirect: redirect || null,
        created_at: createdAt
      };

      tasks.push(newTask);
      fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2)); // save as flat array
    } catch (fsErr) {
      console.warn("Warning: could not write tasks.json:", fsErr);
      // not fatal — continue
    }

    res.json({ success: true, message: "Task added successfully!", task: { id: insertedId, title, description, reward, redirect } });
  } catch (err) {
    console.error("Admin add task error:", err);
    res.status(500).json({ success: false, message: "Server error while adding task" });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const rows = await db.all("SELECT id, title, description, reward, redirect_url AS redirect FROM tasks ORDER BY id DESC");
    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.post("/api/tasks/complete", async (req, res) => {
  const { username, taskId } = req.body;
  console.log("🔍 Task completion request:", { username, taskId });

  if (!username || !taskId) {
    return res.status(400).json({ success: false, message: "Missing username or taskId" });
  }

  try {
    // Check if user exists
    const user = await db.get("SELECT total_balance FROM users WHERE username = ?", [username]);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Find the task
    const task = await db.get("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Check if already completed
    const completed = await db.get(
      "SELECT * FROM task_logs WHERE username = ? AND task_id = ? AND completed = 1",
      [username, taskId]
    );
    if (completed) {
      return res.json({ success: false, message: "Already completed" });
    }

    // AUTO DELETE TASKS OLDER THAN 24 HOURS
setInterval(async () => {
  try {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);

    await db.run("DELETE FROM tasks WHERE created_at < ?", [cutoff]);
    console.log("🧹 Old tasks cleaned");
  } catch (err) {
    console.error("Task cleanup error:", err);
  }
}, 60 * 60 * 1000); // runs every 1 hour

    // Update user balance
    const reward = Number(task.reward) || 0;
    const newBalance = (user.total_balance || 0) + reward;

    await db.run("UPDATE users SET total_balance = ? WHERE username = ?", [newBalance, username]);

    // Log completion
    await db.run(
      "INSERT INTO task_logs (username, task_id, completed, created_at) VALUES (?, ?, 1, ?)",
      [username, taskId, Date.now()]
    );

    // Log wallet + transaction
    await db.run(
      "INSERT INTO wallet_logs (username, amount, type, description, change, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, reward, "credit", `Completed task: ${task.title}`, reward, `task:${taskId}`, Date.now()]
    );

    await db.run(
      "INSERT INTO transactions (username, type, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [username, "task_reward", reward, newBalance, `Completed task: ${task.title}`, Date.now()]
    );

    console.log(`✅ ${username} completed task "${task.title}" (+₦${reward})`);
    res.json({ success: true, reward, balance: newBalance });
  } catch (err) {
    console.error("❌ Task completion error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get user profile by username
app.get("/api/user/:username/profile", async (req, res) => {
  const { username } = req.params;
  try {
    const user = await db.get(
      "SELECT id, fullname, username, email, country, phone, profile_pic FROM users WHERE username = ?",
      [username]
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Add article
app.post("/api/articles/add", upload.single("image"), (req, res) => {
  const { title, content } = req.body;

  let imageUrl = null;
  if (req.file) {
    imageUrl = "/uploads/" + req.file.filename;
  }

  const newArticle = {
    id: uuidv4(),
    title,
    content,
    image: imageUrl,
    createdAt: Date.now(),
    expires_at: Date.now()
  };

  const articles = JSON.parse(fs.readFileSync(ARTICLES_DB));
  articles.push(newArticle);
  fs.writeFileSync(ARTICLES_DB, JSON.stringify(articles));

  res.json({ success: true, article: newArticle });
});

// Get all articles
app.get("/api/articles", (req, res) => {
  const articles = JSON.parse(fs.readFileSync(ARTICLES_DB));
  res.json({ success: true, articles });
});

/*****************************************************
 * START SERVER
 *****************************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
