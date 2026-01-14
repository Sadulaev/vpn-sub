import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { RobokassaService } from './robokassa.service';
import { VpnServersService } from '@modules/vpn-servers';
import { PaymentNotificationService } from './payment-notification.service';

interface RobokassaCallbackBody {
  OutSum: string;
  InvId: string;
  SignatureValue: string;
  Shp_order: string;
}

@Controller('payment')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly robokassaService: RobokassaService,
    private readonly vpnServersService: VpnServersService,
    private readonly notificationService: PaymentNotificationService,
  ) {}

  /**
   * ResultURL — серверный колбэк от Robokassa
   * Вызывается автоматически при успешной оплате
   */
  @Post('approve')
  async handleResult(
    @Body() body: RobokassaCallbackBody,
    @Res() res: Response,
  ) {
    const { OutSum, InvId, SignatureValue, Shp_order } = body;

    this.logger.log(`Received payment callback: InvId=${InvId}, OutSum=${OutSum}`);

    // 1. Верифицируем подпись
    const isValid = this.robokassaService.verifyResultSignature(
      OutSum,
      InvId,
      SignatureValue,
      Shp_order,
    );

    if (!isValid) {
      this.logger.error(`Invalid signature for payment: ${InvId}`);
      return res.status(HttpStatus.BAD_REQUEST).send('Invalid signature');
    }

    // 2. Находим сессию платежа
    const session = await this.paymentsService.findByInvId(InvId);

    if (!session) {
      this.logger.error(`Payment session not found: ${InvId}`);
      return res.status(HttpStatus.NOT_FOUND).send('Session not found');
    }

    // 3. Если уже оплачено — возвращаем OK (идемпотентность)
    if (session.status === 'paid') {
      this.logger.log(`Payment already processed: ${InvId}`);
      return res.send(`OK${InvId}`);
    }

    // 4. Создаём VLESS ключ
    const keyResult = await this.vpnServersService.createVlessKey(session.period);

    if (!keyResult) {
      this.logger.error(`Failed to create VLESS key for payment: ${InvId}`);
      // Уведомляем пользователя о проблеме
      await this.notificationService.notifyKeyGenerationError(session.telegramId);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Key generation failed');
    }

    // 5. Сохраняем ключ и помечаем как оплаченный
    await this.paymentsService.markPaidAndSaveKey(InvId, keyResult.vless);

    // 6. Уведомляем пользователя
    await this.notificationService.notifyPaymentSuccess(
      session.telegramId,
      keyResult.vless,
      session.period,
    );

    this.logger.log(`Payment processed successfully: ${InvId}`);

    // Robokassa ожидает ответ OK{InvId}
    return res.send(`OK${InvId}`);
  }

  /**
   * SuccessURL — редирект пользователя после успешной оплаты
   */
  @Post('success')
  async handleSuccess(@Res() res: Response) {
    // Редиректим пользователя обратно в бота
    return res.redirect('https://t.me/hyper_vpn_bot');
  }

  /**
   * FailURL — редирект при неудачной оплате
   */
  @Post('fail')
  async handleFail(@Res() res: Response) {
    return res.redirect('https://t.me/hyper_vpn_bot');
  }
}

