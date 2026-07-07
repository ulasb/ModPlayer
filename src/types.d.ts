// File System Access API bits missing from lib.dom
interface Window {
  showDirectoryPicker?(options?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?(options?: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle>;
}

interface FileSystemHandle {
  queryPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
}

declare module "butterchurn" {
  export interface ButterchurnVisualizer {
    connectAudio(node: AudioNode): void;
    disconnectAudio(node: AudioNode): void;
    loadPreset(preset: object, blendTime?: number): void;
    setRendererSize(width: number, height: number): void;
    render(): void;
  }
  const butterchurn: {
    createVisualizer(
      context: AudioContext,
      canvas: HTMLCanvasElement,
      options?: { width?: number; height?: number; pixelRatio?: number; textureRatio?: number }
    ): ButterchurnVisualizer;
  };
  export default butterchurn;
}

declare module "butterchurn-presets" {
  const presets: {
    getPresets(): Record<string, object>;
  };
  export default presets;
}
