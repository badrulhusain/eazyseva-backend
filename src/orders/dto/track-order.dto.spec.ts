import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TrackOrderDto } from './track-order.dto';

describe('TrackOrderDto', () => {
  it('accepts an EzySeva order number and Indian mobile number', async () => {
    const dto = plainToInstance(TrackOrderDto, {
      orderNumber: 'ES-2026-00001',
      phone: '9876543210',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed public tracking credentials', async () => {
    const dto = plainToInstance(TrackOrderDto, {
      orderNumber: '123',
      phone: '111',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['orderNumber', 'phone']),
    );
  });
});
