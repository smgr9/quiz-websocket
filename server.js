require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000; // استخدم بورت البيئة
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

// إعداد قاعدة البيانات
const db = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Database connected successfully!");
});

// إعداد WebSocket داخل نفس السيرفر
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  ws.on("message", (message) => {
    console.log(`📩 Received: ${message}`);
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// إعداد API
app.use(cors());
app.use(express.json());

app.get("/questions", (req, res) => {
  db.query("SELECT * FROM questions", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post("/add-question", (req, res) => {
  const { question_text, answer } = req.body;
  if (!question_text || !answer) {
    return res.status(400).json({ error: "❌ كل الحقول مطلوبة" });
  }

  const query = "INSERT INTO questions (question_text, answer) VALUES (?, ?)";
  db.query(query, [question_text, answer], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const newQuestion = { id: result.insertId, question_text, answer };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(newQuestion));
      }
    });

    res.json({
      success: true,
      message: "✅ تم إضافة السؤال بنجاح",
      question: newQuestion,
    });
  });
});
