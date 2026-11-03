let selectedDirectoryHandle: FileSystemDirectoryHandle | null = null;
let selectedDirectoryName: string | null = null;

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function requestDirectoryPicker(): Promise<{ name: string; handle: FileSystemDirectoryHandle } | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  try {
    // Prompt user to pick a folder or drive on their computer
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads',
    });
    selectedDirectoryHandle = handle;
    selectedDirectoryName = handle.name;
    return { name: handle.name, handle };
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Directory picker error:', err);
    }
    return null;
  }
}

export function getSelectedDirectoryInfo(): { name: string | null; hasHandle: boolean } {
  return {
    name: selectedDirectoryName,
    hasHandle: !!selectedDirectoryHandle,
  };
}

export function clearSelectedDirectory() {
  selectedDirectoryHandle = null;
  selectedDirectoryName = null;
}

export async function saveBlobToChosenDirectoryOrDownload(
  blob: Blob,
  fileName: string,
  targetPath?: string
): Promise<{ savedToDirectory: boolean; fileName: string; diskPath?: string }> {
  const pathToSend = targetPath || 'Desktop';

  // First attempt: Call local backend /api/save-file which writes directly to the selected disk drive/folder
  try {
    const res = await fetch('/api/save-file', {
      method: 'POST',
      headers: {
        'x-file-name': encodeURIComponent(fileName),
        'x-target-path': encodeURIComponent(pathToSend),
      },
      body: blob,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        console.log(`[FileSystem] File saved directly to disk at: ${data.savedPath}`);
        return { savedToDirectory: true, fileName, diskPath: data.savedPath };
      }
    }
  } catch (e) {
    console.warn('Direct disk save via API error, checking directory handle or browser fallback:', e);
  }

  // Second attempt: File System Access API directory handle (if user selected one in browser)
  if (selectedDirectoryHandle) {
    try {
      const fileHandle = await selectedDirectoryHandle.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(blob);
      await writable.close();
      return { savedToDirectory: true, fileName };
    } catch (err) {
      console.warn('Failed to write directly to directory handle, falling back to standard download:', err);
    }
  }

  // Standard fallback browser download (clean slashes so browser saves to Downloads cleanly)
  const cleanName = fileName.replace(/^.*[\\\/]/, '') || fileName || 'downloaded-file';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 3000);

  return { savedToDirectory: false, fileName };
}

/**
 * Recursively extracts all files from dropped DataTransfer items,
 * supporting both modern getAsFileSystemHandle and webkitGetAsEntry
 * to properly read dropped folders and preserve relative folder paths.
 */
export async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = dataTransfer.items;

  if (items && items.length > 0) {
    // 1. Try modern W3C File System Access API (getAsFileSystemHandle)
    if (typeof (items[0] as any).getAsFileSystemHandle === 'function') {
      try {
        const handlePromises: Promise<any>[] = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            handlePromises.push((items[i] as any).getAsFileSystemHandle());
          }
        }
        const handles = await Promise.all(handlePromises);

        const readHandle = async (handle: any, parentPath: string): Promise<void> => {
          if (!handle) return;
          if (handle.kind === 'file') {
            const file = await handle.getFile();
            const relPath = parentPath ? `${parentPath}/${file.name}` : file.name;
            Object.defineProperty(file, 'relativePath', {
              value: relPath,
              writable: true,
              configurable: true,
            });
            files.push(file);
          } else if (handle.kind === 'directory') {
            const currentPath = parentPath ? `${parentPath}/${handle.name}` : handle.name;
            for await (const entry of handle.values()) {
              await readHandle(entry, currentPath);
            }
          }
        };

        for (const h of handles) {
          await readHandle(h, '');
        }

        if (files.length > 0) {
          return files;
        }
      } catch (err) {
        console.warn('getAsFileSystemHandle fallback to webkitGetAsEntry:', err);
      }
    }

    // 2. Try webkitGetAsEntry (Chromium, Firefox, Electron)
    const entries: { entry: any; parentPath: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = (item as any).webkitGetAsEntry
          ? (item as any).webkitGetAsEntry()
          : (item as any).getAsEntry?.();
        if (entry) {
          entries.push({ entry, parentPath: '' });
        }
      }
    }

    if (entries.length > 0) {
      const traverseEntry = async (entry: any, parentPath: string): Promise<void> => {
        if (entry.isFile) {
          await new Promise<void>((resolve) => {
            entry.file(
              (file: File) => {
                const relPath = parentPath ? `${parentPath}/${file.name}` : file.name;
                Object.defineProperty(file, 'relativePath', {
                  value: relPath,
                  writable: true,
                  configurable: true,
                });
                files.push(file);
                resolve();
              },
              () => resolve()
            );
          });
        } else if (entry.isDirectory) {
          const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          const reader = entry.createReader();

          const readAllEntries = async (): Promise<any[]> => {
            const list: any[] = [];
            const readBatch = async (): Promise<void> => {
              const batch: any[] = await new Promise((res) => {
                reader.readEntries(
                  (results: any[]) => res(results || []),
                  () => res([])
                );
              });
              if (batch && batch.length > 0) {
                list.push(...batch);
                await readBatch();
              }
            };
            await readBatch();
            return list;
          };

          const subEntries = await readAllEntries();
          for (const sub of subEntries) {
            await traverseEntry(sub, currentPath);
          }
        }
      };

      for (const item of entries) {
        await traverseEntry(item.entry, item.parentPath);
      }

      if (files.length > 0) {
        return files;
      }
    }
  }

  // 3. Fallback for standard files drag
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files);
  }

  return [];
}

