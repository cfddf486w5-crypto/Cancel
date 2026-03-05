import { BlobServiceClient } from '@azure/storage-blob';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { config } from './config.js';

export const saveAttachment = async (requestId: string, fileName: string, contentType: string, bytes: Uint8Array) => {
  if (config.storageMode === 'azure' && config.blobConnectionString) {
    const client = BlobServiceClient.fromConnectionString(config.blobConnectionString);
    const container = client.getContainerClient(config.blobContainer);
    await container.createIfNotExists();
    const blob = container.getBlockBlobClient(`${requestId}/${Date.now()}-${fileName}`);
    await blob.uploadData(bytes, { blobHTTPHeaders: { blobContentType: contentType } });
    return blob.url;
  }

  const dir = path.resolve(process.cwd(), '.mock-uploads', requestId);
  await mkdir(dir, { recursive: true });
  const saved = path.join(dir, `${Date.now()}-${fileName}`);
  await writeFile(saved, bytes);
  return `file://${saved}`;
};
