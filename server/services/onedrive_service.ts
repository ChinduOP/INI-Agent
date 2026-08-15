import fs from 'fs';
import path from 'path';

export interface IniTemplateFile {
  path: string; // e.g. "Partner A/850.ini"
  folder: string; // e.g. "Partner A"
  filename: string; // e.g. "850.ini"
  content: string;
}

class OneDriveService {
  private templates: Map<string, IniTemplateFile> = new Map();

  constructor() {
    this.seedDefaultTemplates();
  }

  private seedDefaultTemplates() {
    const defaultList: IniTemplateFile[] = [];

    defaultList.forEach(item => {
      this.templates.set(item.path.toLowerCase(), item);
    });
  }

  public getOneDriveLink(): string {
    return process.env.ONEDRIVE_TEMPLATES_LINK || "https://1drv.ms/f/s!ExampleSharedFolderLink (Set ONEDRIVE_TEMPLATES_LINK in .env)";
  }

  private scanLocalDirectory(dir: string, baseDir: string, results: IniTemplateFile[]) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue; // skip hidden files

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          this.scanLocalDirectory(fullPath, baseDir, results);
        } else {
          // Include all files as templates if they are in the directory
          const relativePath = path.relative(baseDir, fullPath);
          const folder = path.dirname(relativePath) === '.' ? 'Root' : path.dirname(relativePath);
          
          let content = "";
          // Only read content if it's text based, to prevent crash on large binary files like images, but user might have excel sheets. 
          // Since it's for LLM or preview, we'll try to read as utf-8, but if it's binary it might be garbage. 
          // Let's just read it anyway for now, or just provide filename and empty content if binary.
          try {
             if (item.toLowerCase().endsWith('.ini') || item.toLowerCase().endsWith('.txt') || item.toLowerCase().endsWith('.csv') || item.toLowerCase().endsWith('.json') || item.toLowerCase().endsWith('.md')) {
                content = fs.readFileSync(fullPath, 'utf-8');
             } else {
                content = "Binary or unsupported text file. Filename: " + item;
             }
          } catch(e) {
             content = "Error reading file content.";
          }

          results.push({
            path: relativePath.replace(/\\/g, '/'),
            folder: folder.replace(/\\/g, '/'),
            filename: item,
            content: content
          });
        }
      }
    } catch (e) {
      console.error(`Error scanning local directory ${dir}:`, e);
    }
  }

  public getAllTemplates(): IniTemplateFile[] {
    const localTemplates: IniTemplateFile[] = [];

    // 1. Check path provided in env variable FIRST
    let link = process.env.ONEDRIVE_TEMPLATES_LINK;
    if (link) {
      link = link.replace(/^["']|["']$/g, '').trim();
      const normalizedLink = link.replace(/\\/g, '/').replace(/\/+/g, '/');
      let resolvedLink = normalizedLink;
      if (process.platform !== 'win32' && (normalizedLink.startsWith('C:') || normalizedLink.startsWith('D:'))) {
        resolvedLink = path.resolve(process.cwd(), normalizedLink);
      } else {
        resolvedLink = path.isAbsolute(normalizedLink) ? normalizedLink : path.resolve(process.cwd(), normalizedLink);
      }

      if (!fs.existsSync(resolvedLink)) {
        try {
          fs.mkdirSync(resolvedLink, { recursive: true });
        } catch(e) {
          console.error("Error creating local folder:", e);
        }
      }

      if (fs.existsSync(resolvedLink) && fs.statSync(resolvedLink).isDirectory()) {
        const items = fs.readdirSync(resolvedLink);
        if (items.length === 0) {
          const defaultTemplatesDir = path.resolve(process.cwd(), "ini_templates");
          if (fs.existsSync(defaultTemplatesDir) && defaultTemplatesDir !== resolvedLink) {
            try {
              const defaults = fs.readdirSync(defaultTemplatesDir);
              for (const file of defaults) {
                const src = path.join(defaultTemplatesDir, file);
                const dest = path.join(resolvedLink, file);
                if (fs.statSync(src).isFile()) {
                  fs.copyFileSync(src, dest);
                }
              }
            } catch (copyErr) {
              console.error("Error copying default templates:", copyErr);
            }
          }

          // Ensure sample.ini exists if folder is still empty
          const sampleFile = path.join(resolvedLink, "sample.ini");
          if (!fs.existsSync(sampleFile) && fs.readdirSync(resolvedLink).length === 0) {
            fs.writeFileSync(sampleFile, "; Sample Template\n[Section]\nKey = Value\n", "utf-8");
          }
        }
        this.scanLocalDirectory(resolvedLink, resolvedLink, localTemplates);
      }
    }

    // 2. If ONEDRIVE_TEMPLATES_LINK is not set, or failed to yield files, check workspace 'ini_templates' directory as fallback
    if (localTemplates.length === 0) {
      const workspaceTemplatesDir = path.join(process.cwd(), 'ini_templates');
      if (fs.existsSync(workspaceTemplatesDir) && fs.statSync(workspaceTemplatesDir).isDirectory()) {
        this.scanLocalDirectory(workspaceTemplatesDir, workspaceTemplatesDir, localTemplates);
      }
    }

    if (localTemplates.length > 0) {
      return localTemplates;
    }

    // 3. Fallback to mock templates if no local files found
    return Array.from(this.templates.values());
  }

  public getTemplateByPath(targetPath: string): IniTemplateFile | null {
    const all = this.getAllTemplates();
    const targetLower = targetPath.toLowerCase();

    // 1. Try exact path match
    let match = all.find(t => t.path.toLowerCase() === targetLower);
    if (match) return match;

    // 2. Try filename-only match
    const filenameOnly = targetPath.split('/').pop()?.toLowerCase();
    if (filenameOnly) {
      match = all.find(t => t.filename.toLowerCase() === filenameOnly);
      if (match) return match;
    }

    return null;
  }

  public searchTemplates(query: string): IniTemplateFile[] {
    const q = query.toLowerCase();
    return this.getAllTemplates().filter(t => 
      t.path.toLowerCase().includes(q) ||
      t.folder.toLowerCase().includes(q) ||
      t.filename.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q)
    );
  }

  public addTemplate(folder: string, filename: string, content: string): IniTemplateFile {
    const fullPath = `${folder}/${filename}`;
    const newTemplate: IniTemplateFile = {
      folder,
      filename,
      path: fullPath,
      content
    };
    this.templates.set(fullPath.toLowerCase(), newTemplate);
    return newTemplate;
  }
}

export const onedriveService = new OneDriveService();
