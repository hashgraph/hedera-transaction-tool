import * as fsp from 'fs/promises';

export async function waitAndReadFile(
  filePath: string,
  timeout = 5000,
  interval = 100,
): Promise<Buffer> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await fsp.access(filePath);
      return await fsp.readFile(filePath);
    } catch {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  throw new Error(`File not found: ${filePath}`);
}
