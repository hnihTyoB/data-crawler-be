import { Request, Response, NextFunction } from "express";
import { WebhookConfigService } from "./webhook-config.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";
import { WebhookDeliveryStatus } from "../../common/constants/webhook.constant";

export class WebhookController {
  private readonly configService = new WebhookConfigService();
  private readonly deliveryService = new WebhookDeliveryService();
  private readonly auditLogService = new AuditLogService();

  createConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const { url, secret, events } = req.body;

      const result = await this.configService.create(
        userId,
        url,
        secret,
        events,
      );

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.CREATE_WEBHOOK_CONFIG,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
        details: {
          webhookConfigId: result.id,
          url: result.url,
          events: result.events,
        },
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listConfigs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const result = await this.configService.list(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const configId = req.params.id;

      const result = await this.configService.delete(configId, userId);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.DELETE_WEBHOOK_CONFIG,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
        details: { webhookConfigId: configId, url: result.url },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const configId = req.params.id;
      const result = await this.configService.update(
        configId,
        userId,
        req.body,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  testConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const configId = req.params.id;
      const result = await this.configService.test(configId, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listDeliveries = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const jobId = req.query.jobId as string | undefined;
      const status = req.query.status as WebhookDeliveryStatus | undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await this.deliveryService.listDeliveries(userId, {
        jobId,
        status,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  redeliver = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const deliveryId = req.params.id;

      const result = await this.deliveryService.redeliver(deliveryId, userId);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.REDELIVER_WEBHOOK,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
        details: { deliveryId: result.id, event: result.event },
      });

      res.json({
        success: true,
        message: "Webhook redelivery enqueued successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
