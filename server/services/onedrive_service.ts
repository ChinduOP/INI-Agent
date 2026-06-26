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

  public getAllTemplates(): IniTemplateFile[] {
    return Array.from(this.templates.values());
  }

  public getTemplateByPath(path: string): IniTemplateFile | null {
    return this.templates.get(path.toLowerCase()) || null;
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
