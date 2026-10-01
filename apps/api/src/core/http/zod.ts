import { Body, HttpStatus, Query, type PipeTransform } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiException } from './api-exception.js';

/** Đổi lỗi zod thành { "phone": "Số điện thoại chưa đúng", … } */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Pipe kiểm tra + chuẩn hoá dữ liệu bằng schema zod (dùng chung schema với web / mobile) */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const fields = zodFieldErrors(result.error);
      throw new ApiException('VALIDATION_ERROR', Object.values(fields)[0] ?? 'Dữ liệu không hợp lệ', HttpStatus.BAD_REQUEST, fields);
    }
    return result.data;
  }
}

type JsonSchema = Record<string, any>;

/** Schema zod → JSON Schema (OpenAPI 3.0) để hiển thị trên trang /docs */
function toOpenApi(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }) as JsonSchema;
  delete json.$schema;
  return json;
}

function methodDescriptor(target: object, key: string | symbol | undefined) {
  if (key === undefined) throw new Error('ZodBody / ZodQuery chỉ dùng cho tham số của method');
  return { key, descriptor: Object.getOwnPropertyDescriptor(target, key)! };
}

/**
 * Nhận body đã kiểm tra bằng zod + tự ghi tài liệu OpenAPI.
 *   create(@ZodBody(applySchema) body: ApplyInput)
 */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
  return (target, propertyKey, index) => {
    Body(new ZodPipe(schema))(target, propertyKey, index);
    const { key, descriptor } = methodDescriptor(target, propertyKey);
    ApiBody({ schema: toOpenApi(schema) })(target, key, descriptor);
  };
}

/**
 * Nhận query string đã kiểm tra bằng zod + ghi từng tham số vào OpenAPI.
 *   search(@ZodQuery(jobSearchSchema) query: JobSearchQuery)
 */
export function ZodQuery(schema: z.ZodType): ParameterDecorator {
  return (target, propertyKey, index) => {
    Query(new ZodPipe(schema))(target, propertyKey, index);
    const { key, descriptor } = methodDescriptor(target, propertyKey);
    const json = toOpenApi(schema);
    const required = new Set<string>(json.required ?? []);
    for (const [name, prop] of Object.entries<JsonSchema>(json.properties ?? {})) {
      ApiQuery({ name, required: required.has(name) && prop.default === undefined, schema: prop })(target, key, descriptor);
    }
  };
}
