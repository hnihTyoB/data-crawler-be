export interface ExtractionFieldDto {
  name: string;
  selector: string;
  attr: string;
  required: boolean;
}

export interface CreateExtractionTemplateDto {
  name: string;
  domain: string;
  fields: ExtractionFieldDto[];
}

export interface UpdateExtractionTemplateDto {
  name?: string;
  fields?: ExtractionFieldDto[];
}
