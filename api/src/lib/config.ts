import dotenv from 'dotenv';

dotenv.config();

export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  storageMode: process.env.STORAGE_MODE || 'mock',
  pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS || 20),
  teamsWebhook: process.env.TEAMS_WEBHOOK_URL,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  emailToDefault: process.env.EMAIL_TO_DEFAULT,
  blobConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  blobContainer: process.env.BLOB_CONTAINER || 'cancel-attachments'
};

export const notificationsConfigured = Boolean(config.teamsWebhook || (config.sendgridApiKey && config.emailToDefault));
