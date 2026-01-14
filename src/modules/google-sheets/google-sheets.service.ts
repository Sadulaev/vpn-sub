import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';

@Injectable()
export class GoogleSheetsService implements OnModuleInit {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets | null = null;
  private readonly spreadsheetId: string;
  private readonly timeout = 10000;

  constructor(private readonly configService: ConfigService) {
    const googleSheets = this.configService.get('googleSheets');
    this.spreadsheetId = googleSheets?.spreadsheetId || '';
  }

  async onModuleInit(): Promise<void> {
    const googleSheets = this.configService.get('googleSheets');
    const clientEmail = googleSheets?.clientEmail;
    const privateKey = googleSheets?.privateKey;

    if (!clientEmail || !privateKey || !this.spreadsheetId) {
      this.logger.warn('Google Sheets credentials not configured, skipping initialization');
      return;
    }

    try {
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      google.options({ timeout: this.timeout });

      await this.withTimeout(auth.authorize(), this.timeout);
      this.logger.log('Google JWT authorized successfully');

      this.sheets = google.sheets({ version: 'v4', auth });

      // Проверяем доступ к таблице
      const meta = await this.withTimeout(
        this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId }),
        this.timeout,
      );

      const titles = meta.data.sheets?.map((s) => s.properties?.title);
      this.logger.log(`Available sheets: ${titles?.join(', ')}`);
    } catch (error: any) {
      this.logger.error('Failed to initialize Google Sheets:', error?.message || error);
    }
  }

  /**
   * Добавить строку в таблицу
   */
  async appendRow(
    sheetName: string,
    values: (string | number | boolean | null)[],
  ): Promise<void> {
    if (!this.sheets) {
      this.logger.warn('Google Sheets not initialized, skipping appendRow');
      return;
    }

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      });

      this.logger.debug(`Row appended to ${sheetName}`);
    } catch (error: any) {
      this.logger.error(`Failed to append row to ${sheetName}:`, error?.message || error);
      throw error;
    }
  }

  /**
   * Прочитать диапазон из таблицы
   */
  async readRange(range = 'Лист1!A1:D5'): Promise<any[][]> {
    if (!this.sheets) {
      this.logger.warn('Google Sheets not initialized, returning empty array');
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error: any) {
      this.logger.error(`Failed to read range ${range}:`, error?.message || error);
      return [];
    }
  }

  /**
   * Получить уникальные Telegram ID из первого столбца
   */
  async getUniqueTelegramIds(sheetName = 'Лист1'): Promise<string[]> {
    if (!this.sheets) {
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const rows = response.data.values?.flat() || [];
      const valuesNoHeader = rows.slice(1); // Пропускаем заголовок

      const unique = [
        ...new Set(
          valuesNoHeader
            .map((v) => (v ?? '').toString().trim())
            .filter((v) => v !== ''),
        ),
      ];

      return unique;
    } catch (error: any) {
      this.logger.error(`Failed to get Telegram IDs from ${sheetName}:`, error?.message || error);
      return [];
    }
  }

  /**
   * Обёртка для Promise с таймаутом
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Google API timeout after ${ms}ms`)), ms),
      ),
    ]);
  }
}

