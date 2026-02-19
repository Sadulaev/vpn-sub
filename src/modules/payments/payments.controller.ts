import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { RobokassaService } from './robokassa.service';
import { PaymentNotificationService } from './payment-notification.service';
import { SubscriptionsService } from '@modules/subscriptions';
import { SubscriptionSource } from '@database/entities';

interface RobokassaCallbackBody {
  OutSum: string;
  InvId: string;
  SignatureValue: string;
  Shp_order: string;
}

@ApiTags('Payments')
@Controller('payment')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly robokassaService: RobokassaService,
    private readonly notificationService: PaymentNotificationService,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('approve')
  @ApiOperation({ summary: 'ResultURL колбэк Robokassa', description: 'Серверный колбэк от Robokassa при успешной оплате. Вызывается автоматически.' })
  @ApiResponse({ status: 200, description: 'Оплата обработана, ответ OK{InvId}' })
  @ApiResponse({ status: 400, description: 'Неверная подпись' })
  @ApiResponse({ status: 404, description: 'Сессия платежа не найдена' })
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

    // 4. Создаем подписку (преобразуем месяцы в дни: 1 месяц = 30 дней)
    const result = await this.subscriptionsService.createSubscription({
      telegramId: session.telegramId,
      days: session.period * 30,
      source: SubscriptionSource.BOT,
    });

    // 5. Помечаем платеж как оплаченный
    await this.paymentsService.markPaid(InvId);

    // 6. Уведомляем пользователя
    await this.notificationService.notifyPaymentSuccess(
      session.telegramId,
      result.subscriptionUrl,
      session.period,
    );

    this.logger.log(`Payment processed successfully: ${InvId}`);

    // Robokassa ожидает ответ OK{InvId}
    return res.send(`OK${InvId}`);
  }

  @Post('success')
  @ApiExcludeEndpoint()
  async handleSuccess(@Res() res: Response) {
    // Редиректим пользователя обратно в бота
    return res.redirect('https://t.me/bekvpn_bot');
  }

  @Post('fail')
  @ApiExcludeEndpoint()
  async handleFail(@Res() res: Response) {
    return res.redirect('https://t.me/bekvpn_bot');
  }
}

