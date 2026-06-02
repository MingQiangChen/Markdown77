import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("markdown77", {
  openVault: () => ipcRenderer.invoke("vault:open"),
  listFiles: (vaultPath: string) => ipcRenderer.invoke("vault:listFiles", vaultPath),
  readFile: (vaultPath: string, relativePath: string) =>
    ipcRenderer.invoke("vault:readFile", vaultPath, relativePath),
  writeFile: (vaultPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke("vault:writeFile", vaultPath, relativePath, content)
});
