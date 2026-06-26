import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

import { ExcelService } from "./server/services/excel_service.js";
import { onedriveService } from "./server/services/onedrive_service.js";
import { LangGraphEngine } from "./server/graph/graph.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `uploaded_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '')}`);
  }
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Global state tracking active uploaded workbook
  let currentUploadedExcel: { path: string; name: string } | null = null;

  // 1. Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "INI Agent LangGraph Backend" });
  });

  // 2. Upload Excel file
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No Excel file uploaded" });
      }
      currentUploadedExcel = {
        path: req.file.path,
        name: req.file.originalname
      };
      
      const parsed = await ExcelService.parseExcelFile(req.file.path);

      res.json({
        success: true,
        file: currentUploadedExcel,
        summary: {
          modulesCount: parsed.modules.length,
          ediCount: parsed.edi.length,
          documentCount: parsed.document.length
        }
      });
    } catch (err: any) {
      console.error("Error uploading Excel:", err);
      res.status(500).json({ error: err.message || "Failed to process Excel upload" });
    }
  });

  // 3. Load Sample Excel (Convenience for testing without user having local excel file)
  app.post("/api/sample-excel", async (req, res) => {
    try {
      const sampleBuffer = await ExcelService.generateSampleWorkbook();
      const samplePath = path.join(uploadsDir, `sample_partners_${Date.now()}.xlsx`);
      fs.writeFileSync(samplePath, sampleBuffer);

      currentUploadedExcel = {
        path: samplePath,
        name: "Sample_TradingPartners_EDI.xlsx"
      };

      const parsed = await ExcelService.parseExcelFile(samplePath);

      res.json({
        success: true,
        file: currentUploadedExcel,
        summary: {
          modulesCount: parsed.modules.length,
          ediCount: parsed.edi.length,
          documentCount: parsed.document.length
        }
      });
    } catch (err: any) {
      console.error("Error generating sample Excel:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Get active upload status
  app.get("/api/upload/status", (req, res) => {
    res.json({ activeFile: currentUploadedExcel });
  });

  // 5. OneDrive Templates
  app.get("/api/onedrive/templates", (req, res) => {
    const q = req.query.q ? String(req.query.q) : "";
    const templates = q ? onedriveService.searchTemplates(q) : onedriveService.getAllTemplates();
    res.json({ templates, link: onedriveService.getOneDriveLink() });
  });

  app.get("/api/onedrive/template", (req, res) => {
    const filePath = req.query.path ? String(req.query.path) : "";
    const template = onedriveService.getTemplateByPath(filePath);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ template });
  });

  // 5.5 Excel Templates Info
  app.get("/api/excel-templates", (req, res) => {
    const templatePath = path.join(process.cwd(), "excel_templates", "reference_schema.json");
    let schema = null;
    if (fs.existsSync(templatePath)) {
      schema = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
    }
    res.json({ folder: "/excel_templates", schema });
  });


  // 6. Main LangGraph Chat & Orchestration Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, chatHistory = [] } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message content required" });
      }

      const result = await LangGraphEngine.run(
        message,
        currentUploadedExcel ? currentUploadedExcel.path : null,
        currentUploadedExcel ? currentUploadedExcel.name : null,
        chatHistory
      );

      res.json({
        assistantMessage: result.assistantMessage,
        generatedIni: result.generatedIni,
        trace: result.trace,
        needsExcelUpload: result.needsExcelUpload,
        activeExcelName: currentUploadedExcel ? currentUploadedExcel.name : null
      });
    } catch (err: any) {
      console.error("Error executing LangGraph chat flow:", err);
      res.status(500).json({ error: err.message || "LangGraph orchestration error" });
    }
  });

  // 7. Download Stream Endpoint
  app.post("/api/download", (req, res) => {
    const { filename, content } = req.body;
    if (!filename || content === undefined) {
      return res.status(400).json({ error: "Filename and content required" });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, '')}"`);
    res.send(content);
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 INI Agent LangGraph Server running on http://localhost:${PORT}`);
  });
}

startServer();
