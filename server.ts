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

import { LlmService } from "./server/services/llm_service.js";

dotenv.config({ override: true });

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url || 'file://' + process.cwd() + '/server.ts');
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

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

  // 1.5 AI Configuration Status
  app.get("/api/ai/status", async (req, res) => {
    try {
      const isConfigured = await LlmService.testConnection();
      res.json(isConfigured);
    } catch (e: any) {
      res.json({ success: false, message: e.message || "Unknown error connecting to AI" });
    }
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

  // 4.5 Get active upload parsed data
  app.get("/api/upload/data", async (req, res) => {
    try {
      if (!currentUploadedExcel) {
        // Fallback to reading the extracted_context.json file
        const templatePath = path.join(process.cwd(), "excel_templates", "extracted_context.json");
        if (fs.existsSync(templatePath)) {
          const content = fs.readFileSync(templatePath, "utf-8");
          const data = JSON.parse(content);
          return res.json({ success: true, data });
        }
        return res.json({ success: false, message: "No active uploaded Excel file and default context missing" });
      }
      const parsed = await ExcelService.parseExcelFile(currentUploadedExcel.path);
      const extracted = ExcelService.extractExcelToJson(parsed);
      const uiCompatible = ExcelService.convertSchemaJsonToUiFormat(extracted);
      res.json({ success: true, data: uiCompatible, schemaData: extracted });
    } catch (err: any) {
      console.error("Error fetching active Excel data:", err);
      res.status(500).json({ error: err.message || "Failed to parse active Excel" });
    }
  });

  app.post("/api/custom-context/extract", async (req, res) => {
    try {
      const { extractedData, definitions } = req.body || {};
      if (!Array.isArray(extractedData) || !Array.isArray(definitions)) {
        return res.status(400).json({ error: "Extracted Excel data and custom key definitions are required." });
      }

      const validDefinitions = definitions.filter((definition: any) =>
        definition &&
        typeof definition.keyName === "string" &&
        typeof definition.prompt === "string" &&
        definition.keyName.trim() &&
        definition.prompt.trim()
      );
      const values = await LlmService.extractCustomContextValues(extractedData, validDefinitions);
      res.json({ success: true, values });
    } catch (err: any) {
      console.error("Error extracting custom context values:", err);
      res.status(500).json({ error: err.message || "Failed to extract custom context values." });
    }
  });

  // Helper to determine the template folder path (defaulting to ONEDRIVE_TEMPLATES_LINK from .env)
  function getTemplateFolder(queryDir?: any, forDisplay = false): string {
    if (queryDir && String(queryDir).trim()) {
      const q = String(queryDir).trim();
      if (!q.startsWith("http://") && !q.startsWith("https://")) {
        if (forDisplay) {
          return q.replace(/\\\\/g, '\\').replace(/\\/g, '\\');
        }
        return q.replace(/\\/g, '/').replace(/\/+/g, '/');
      }
    }
    let link = process.env.ONEDRIVE_TEMPLATES_LINK || "ini_templates";
    link = link.replace(/^["']|["']$/g, '').trim();
    if (link.startsWith("http://") || link.startsWith("https://")) {
      return "ini_templates";
    }
    if (forDisplay) {
      return link.replace(/\\\\/g, '\\').replace(/\\/g, '\\');
    }
    return link.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  // API to get template folder configuration
  app.get("/api/templates/config", (req, res) => {
    try {
      const defaultDir = getTemplateFolder(undefined, true);
      res.json({ success: true, defaultDir });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Helper to generate a tree recursively for local templates
  function getFilesTree(dirPath: string, rootDir: string, currentId = "1"): any[] {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      const items = fs.readdirSync(dirPath);
      const nodes: any[] = [];
      
      let index = 1;
      for (const item of items) {
        if (item === 'node_modules' || item === '.git' || item === 'dist' || item === '.aistudio') {
          continue;
        }
        const fullPath = path.join(dirPath, item);
        const relativePath = path.relative(rootDir, fullPath);
        const stats = fs.statSync(fullPath);
        const id = `${currentId}-${index}`;
        index++;

        if (stats.isDirectory()) {
          const children = getFilesTree(fullPath, rootDir, id);
          nodes.push({
            id,
            name: item,
            type: 'folder',
            path: relativePath,
            isOpen: false,
            children
          });
        } else {
          const ext = path.extname(item).toLowerCase().replace('.', '');
          // Read content only if it's an editable text file (like .ini, .sql, .xml, .txt, .json, .md)
          let content = '';
          if (['ini', 'sql', 'xml', 'txt', 'json', 'md'].includes(ext)) {
            content = fs.readFileSync(fullPath, 'utf-8');
          }
          nodes.push({
            id,
            name: item,
            type: 'file',
            fileType: ext === 'sql' ? 'sql' : ext === 'xml' ? 'xml' : ext === 'json' ? 'json' : 'ini',
            content,
            path: relativePath
          });
        }
      }
      return nodes;
    } catch (err) {
      console.error("Error generating files tree:", err);
      return [];
    }
  }

  // Helper to copy directory recursively
  function copyDirectoryRecursive(srcDir: string, destDir: string) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const items = fs.readdirSync(srcDir);
    for (const item of items) {
      const srcPath = path.join(srcDir, item);
      const destPath = path.join(destDir, item);
      if (fs.statSync(srcPath).isDirectory()) {
        copyDirectoryRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // API to list template files in a configured folder path
  app.get("/api/templates/list", (req, res) => {
    try {
      const qDir = getTemplateFolder(req.query.dir);
      const resolvedDir = path.isAbsolute(qDir) ? qDir : path.resolve(process.cwd(), qDir);
      
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }

      // If the target folder is empty, copy default templates from the 'ini_templates' folder
      const items = fs.readdirSync(resolvedDir);
      if (items.length === 0) {
        const defaultTemplatesDir = path.resolve(process.cwd(), "ini_templates");
        if (fs.existsSync(defaultTemplatesDir) && defaultTemplatesDir !== resolvedDir) {
          try {
            copyDirectoryRecursive(defaultTemplatesDir, resolvedDir);
          } catch (copyErr) {
            console.error("Error copying default templates recursively:", copyErr);
          }
        }
      }

      const tree = getFilesTree(resolvedDir, resolvedDir);
      res.json({ success: true, folderPath: resolvedDir, data: tree });
    } catch (err: any) {
      console.error("Error listing templates:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API to save a template file locally on disk
  app.post("/api/templates/save", (req, res) => {
    try {
      const { filePath, content, configuredDir } = req.body;
      if (!filePath) {
        return res.status(400).json({ success: false, error: "File path is required" });
      }

      const qDir = getTemplateFolder(configuredDir);
      const resolvedDir = path.isAbsolute(qDir) ? qDir : path.resolve(process.cwd(), qDir);
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(resolvedDir, filePath);

      const parentDir = path.dirname(resolvedPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(resolvedPath, content || "", "utf-8");
      console.log(`Saved template to ${resolvedPath}`);
      res.json({ success: true, message: "File saved successfully", path: resolvedPath });
    } catch (err: any) {
      console.error("Error saving template:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API to create a file or folder in a configured folder path
  app.post("/api/templates/create", (req, res) => {
    try {
      const { nodeName, parentPath, type, configuredDir } = req.body;
      if (!nodeName) {
        return res.status(400).json({ success: false, error: "Node name is required" });
      }

      const qDir = getTemplateFolder(configuredDir);
      const resolvedDir = path.isAbsolute(qDir) ? qDir : path.resolve(process.cwd(), qDir);
      
      const parentResolved = parentPath 
        ? (path.isAbsolute(parentPath) ? parentPath : path.resolve(resolvedDir, parentPath))
        : resolvedDir;

      const targetPath = path.join(parentResolved, nodeName);

      if (type === 'folder') {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
      } else {
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, "", "utf-8");
        }
      }

      const relativeToConfigured = path.relative(resolvedDir, targetPath);
      res.json({ success: true, path: relativeToConfigured });
    } catch (err: any) {
      console.error("Error creating template node:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API to delete a file or folder in a configured folder path
  app.post("/api/templates/delete", (req, res) => {
    try {
      const { filePath, configuredDir } = req.body;
      if (!filePath) {
        return res.status(400).json({ success: false, error: "File path is required" });
      }

      const qDir = getTemplateFolder(configuredDir);
      const resolvedDir = path.isAbsolute(qDir) ? qDir : path.resolve(process.cwd(), qDir);
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(resolvedDir, filePath);

      if (fs.existsSync(resolvedPath)) {
        const stats = fs.statSync(resolvedPath);
        if (stats.isDirectory()) {
          fs.rmSync(resolvedPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(resolvedPath);
        }
        res.json({ success: true, message: "Node deleted successfully" });
      } else {
        res.status(404).json({ success: false, error: "Node not found on disk" });
      }
    } catch (err: any) {
      console.error("Error deleting template node:", err);
      res.status(500).json({ success: false, error: err.message });
    }
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
      const { message, chatHistory = [], selectedTemplateAttachments, textMappings } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message content required" });
      }

      // If multiple templates are sent, process sequentially for now, 
      // or update LangGraphEngine to handle an array if necessary.
      // Assuming for now it handles the first one for simplicity or needs update.
      let attachments = Array.isArray(selectedTemplateAttachments) ? selectedTemplateAttachments : [selectedTemplateAttachments];
      if (attachments.length === 0) attachments = [null];
      
      let allGeneratedInis: any[] = [];
      let finalAssistantMessage = '';
      let finalTrace: any[] = [];
      let needsExcelUpload = false;
      
      const results = await Promise.all(attachments.map(attachment => 
          LangGraphEngine.run(
            message,
            currentUploadedExcel ? currentUploadedExcel.path : null,
            currentUploadedExcel ? currentUploadedExcel.name : null,
            chatHistory,
            attachment,
            textMappings
          )
      ));
      
        // Deduplicate generated INIs strictly by filename (case-insensitive) across all runs
        const seenGeneratedFiles = new Set<string>();
        for (const result of results) {
          if (result.generatedInis && result.generatedInis.length > 0) {
            for (const item of result.generatedInis) {
              const fileKey = (item.filename || '').toLowerCase().trim();
              if (fileKey && !seenGeneratedFiles.has(fileKey)) {
                seenGeneratedFiles.add(fileKey);
                allGeneratedInis.push(item);
              }
            }
          }
          if (result.assistantMessage && !finalAssistantMessage.includes(result.assistantMessage)) {
              finalAssistantMessage += (finalAssistantMessage ? '\n' : '') + result.assistantMessage;
          }
          if (result.trace) {
              finalTrace.push(...result.trace);
          }
          if (result.needsExcelUpload) {
              needsExcelUpload = true;
          }
      }

      res.json({
        assistantMessage: finalAssistantMessage || 'Processing complete.',
        generatedInis: allGeneratedInis,
        trace: finalTrace,
        needsExcelUpload: needsExcelUpload,
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
