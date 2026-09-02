import { z } from 'zod';

const extractionFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  selector: z.string().min(1, 'CSS selector is required'),
  attr: z.string().min(1, 'attr is required (use "innerText" for text content)'),
  required: z.boolean(),
});

export const createExtractionTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  domain: z
    .string()
    .min(1, 'Domain is required')
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Domain must be a valid hostname (e.g. example.com)'),
  fields: z
    .array(extractionFieldSchema)
    .min(1, 'At least one field is required'),
});

export const updateExtractionTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  fields: z.array(extractionFieldSchema).min(1).optional(),
});