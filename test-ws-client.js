const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connected to WebSocket server");
  ws.send("Hello Server!");
});

ws.on("message", (message) => {
  console.log("📩 Received:", message.toString());
});

ws.on("error", (error) => {
  console.error("❌ Error:", error.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected from server");
});
