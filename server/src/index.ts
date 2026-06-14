import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import commandRouter from "./commandRouter.ts";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParseRequest, ParseResponse } from "../../shared/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ========== 挂载指令解析路由 ==========
app.use("/api", commandRouter);

// ========== Health check ==========
app.get("/api/health", (_req, res) => {
  const hasApiKey = !!(process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_API_KEY !== "sk-xxx");
  res.json({
    status: "ok",
    timestamp: Date.now(),
    llm: hasApiKey ? "available" : "unconfigured",
    model: process.env.LLM_MODEL || "qwen-turbo",
  });
});

// ========== WebSocket 指令解析 ==========
io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // 接收前端 LLM 解析请求
  socket.on("parse:command", async (data: ParseRequest) => {
    const { text } = data;
    if (!text || typeof text !== "string") {
      socket.emit("parse:result", {
        type: "unrecognized",
        params: {},
        raw: "",
        error: "Missing text",
      } satisfies ParseResponse);
      return;
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey || apiKey === "sk-xxx") {
      socket.emit("parse:result", {
        type: "unrecognized",
        params: {},
        raw: text,
        error: "DASHSCOPE_API_KEY not configured",
      } satisfies ParseResponse);
      return;
    }

    try {
      // 通过 HTTP 调用自身 /api/command/parse（避免重复代码）
      const response = await fetch(`http://localhost:${PORT}/api/command/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const result = await response.json() as ParseResponse;
      socket.emit("parse:result", result);
    } catch (err: unknown) {
      socket.emit("parse:result", {
        type: "unrecognized",
        params: {},
        raw: text,
        error: (err as Error)?.message || "WS parse failed",
      } satisfies ParseResponse);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
