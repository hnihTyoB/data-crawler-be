import { Request, Response, NextFunction } from "express";
import { ExtractionTemplateService } from "./extraction-template.service";

export class ExtractionTemplateController {
  private readonly service = new ExtractionTemplateService();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.create(req.user.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findAll(req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.user.id, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.update(
        req.user.id,
        req.params.id,
        req.body,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.user.id, req.params.id);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  };
}
