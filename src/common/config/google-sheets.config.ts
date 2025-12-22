import { registerAs } from '@nestjs/config';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export default registerAs(
  'googleSheets',
  (): GoogleSheetsConfig => ({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID || '',
    clientEmail: process.env.GOOGLE_SA_CLIENT_EMAIL || '',
    privateKey: (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
);

