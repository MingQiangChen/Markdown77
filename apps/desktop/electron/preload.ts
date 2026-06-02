import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("markdown77", {
  openVault: () => ipcRenderer.invoke("vault:open"),
  listFiles: (vaultPath: string) => ipcRenderer.invoke("vault:listFiles", vaultPath),
  readFile: (vaultPath: string, relativePath: string) =>
    ipcRenderer.invoke("vault:readFile", vaultPath, relativePath),
  writeFile: (vaultPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke("vault:writeFile", vaultPath, relativePath, content),
  createFile: (vaultPath: string, preferredRelativePath: string, content: string) =>
    ipcRenderer.invoke("vault:createFile", vaultPath, preferredRelativePath, content),
  createFolder: (vaultPath: string, folderName: string) =>
    ipcRenderer.invoke("vault:createFolder", vaultPath, folderName),
  renameFile: (vaultPath: string, currentRelativePath: string, nextRelativePath: string) =>
    ipcRenderer.invoke("vault:renameFile", vaultPath, currentRelativePath, nextRelativePath),
  deleteFile: (vaultPath: string, relativePath: string) =>
    ipcRenderer.invoke("vault:deleteFile", vaultPath, relativePath)
});
