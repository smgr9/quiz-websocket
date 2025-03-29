require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = 3000;

// إعداد قاعدة البيانات
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // غيرها لو عندك يوزر مختلف
  password: "", // ضع الباسورد لو عندك
  database: "quiz_db",
});

db.connect((err) => {
  if (err) {
    console.error("❌  Database connection failed:", err);
    return;
  }
  console.log("✅ Database connected successfully!");
});

// إعداد WebSocket
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  ws.on("message", (message) => {
    console.log(`📩 Received: ${message}`);
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// إعداد API لاسترجاع الأسئلة
app.use(cors());
app.use(express.json());

app.get("/questions", (req, res) => {
  db.query("SELECT * FROM questions", (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API لإضافة سؤال جديد
app.post("/add-question", (req, res) => {
  const { question_text, answer } = req.body;
  if (!question_text || !answer) {
    return res.status(400).json({ error: "❌ كل الحقول مطلوبة" });
  }

  const query = "INSERT INTO questions (question_text, answer) VALUES (?, ?)";
  db.query(query, [question_text, answer], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // إرسال التحديث لكل المتصلين بالـ WebSocket
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

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
