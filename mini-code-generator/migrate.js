const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.run("ALTER TABLE users ADD COLUMN profile_pic TEXT", (err) => {
    if (err) {
        console.log("Migration error:", err.message);
    } else {
        console.log("Column added successfully.");
    }
    db.close();
});
