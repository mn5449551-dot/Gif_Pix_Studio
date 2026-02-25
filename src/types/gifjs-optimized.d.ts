declare module "gif.js.optimized" {
  interface GifOptions {
    workers?: number;
    quality?: number;
    width: number;
    height: number;
    workerScript: string;
    transparent?: number;
  }

  interface GifAddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  type ProgressHandler = (progress: number) => void;
  type FinishedHandler = (blob: Blob) => void;
  type ErrorHandler = (error: Error) => void;

  export default class GIF {
    constructor(options: GifOptions);
    addFrame(image: CanvasImageSource, options?: GifAddFrameOptions): void;
    on(event: "progress", handler: ProgressHandler): void;
    on(event: "finished", handler: FinishedHandler): void;
    on(event: "error", handler: ErrorHandler): void;
    render(): void;
  }
}
