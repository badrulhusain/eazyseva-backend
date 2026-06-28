import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(PaginationDto, plain, {
    enableImplicitConversion: true,
  });
  return validate(dto);
}

describe('PaginationDto', () => {
  it('accepts valid page and limit', async () => {
    const errors = await validateDto({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('defaults page to 1 and limit to 20 when not provided', () => {
    const dto = plainToInstance(
      PaginationDto,
      {},
      { enableImplicitConversion: true },
    );
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit < 1', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit > 100', async () => {
    const errors = await validateDto({ limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit = 100 (boundary)', async () => {
    const errors = await validateDto({ limit: 100 });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid status value', async () => {
    const errors = await validateDto({ status: 'UNKNOWN_STATUS' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('accepts valid status values', async () => {
    for (const status of ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']) {
      const errors = await validateDto({ status });
      expect(errors).toHaveLength(0);
    }
  });

  it('validates payment status filters', async () => {
    expect(await validateDto({ paymentStatus: 'PAID' })).toHaveLength(0);
    const errors = await validateDto({ paymentStatus: 'REFUNDED' });
    expect(errors.some((e) => e.property === 'paymentStatus')).toBe(true);
  });
});
