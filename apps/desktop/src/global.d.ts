export type VaultFile = {
  path: string;
  name: string;
  modifiedAt: number;
};

export type VaultInfo = {
  path: string;
  name: string;
  files: VaultFile[];
};

declare global {
  interface Window {
    markdown77?: {
      openVault: () => Promise<VaultInfo | null>;
      listFiles: (vaultPath: string) => Promise<VaultFile[]>;
      readFile: (vaultPath: string, relativePath: string) => Promise<string>;
      writeFile: (
        vaultPath: string,
        relativePath: string,
        content: string
      ) => Promise<boolean>;
    };
  }
}
