export type VaultFile = {
  path: string;
  name: string;
  modifiedAt: number;
};

export type VaultFolder = {
  path: string;
  name: string;
};

export type VaultContents = {
  files: VaultFile[];
  folders: VaultFolder[];
};

export type SearchResult = {
  path: string;
  title: string;
  snippet: string;
  matchType: "filename" | "content";
};

export type Backlink = {
  sourcePath: string;
  label: string;
  snippet: string;
};

export type VaultInfo = {
  path: string;
  name: string;
  files: VaultFile[];
  folders: VaultFolder[];
};

declare global {
  interface Window {
    markdown77?: {
      openVault: () => Promise<VaultInfo | null>;
      getLastVault: () => Promise<VaultInfo | null>;
      setLastVault: (vaultPath: string | null) => Promise<boolean>;
      listFiles: (vaultPath: string) => Promise<VaultContents>;
      search: (vaultPath: string, query: string) => Promise<SearchResult[]>;
      getBacklinks: (vaultPath: string, relativePath: string) => Promise<Backlink[]>;
      readFile: (vaultPath: string, relativePath: string) => Promise<string>;
      writeFile: (
        vaultPath: string,
        relativePath: string,
        content: string
      ) => Promise<boolean>;
      createFile: (
        vaultPath: string,
        preferredRelativePath: string,
        content: string
      ) => Promise<VaultFile>;
      createFolder: (vaultPath: string, folderName: string) => Promise<VaultFolder>;
      renameFile: (
        vaultPath: string,
        currentRelativePath: string,
        nextRelativePath: string
      ) => Promise<VaultFile>;
      deleteFile: (vaultPath: string, relativePath: string) => Promise<boolean>;
    };
  }
}
