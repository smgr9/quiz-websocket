require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد قاعدة البيانات مع Pool لتحسين الأداء
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: true, // إذا واجهت مشاكل، يمكن تغييره إلى false
  },
});

// فحص الاتصال بقاعدة البيانات
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Database connected successfully!");
    connection.release();
  }
});

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

// جلب الأسئلة من قاعدة البيانات
app.get("/questions", async (req, res) => {
  try {
    const [results] = await db.promise().query("SELECT * FROM questions");
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة سؤال جديد
app.post("/add-question", async (req, res) => {
  const { question_text, answer } = req.body;
  if (!question_text || !answer) {
    return res.status(400).json({ error: "❌ كل الحقول مطلوبة" });
  }

  try {
    const [result] = await db.promise().query(
      "INSERT INTO questions (question_text, answer) VALUES (?, ?)",
      [question_text, answer]
    );

    const newQuestion = { id: result.insertId, question_text, answer };

    // إرسال التحديث لكل المتصلين بالـ WebSocket
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
