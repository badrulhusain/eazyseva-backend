import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { ALLOWED_MIME_TYPES } from './constants/allowed-file-types';

// The service only needs ConfigService.get for MAX_FILE_SIZE_MB and CLOUDINARY_TIMEOUT_MS.
const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'MAX_FILE_SIZE_MB') return 5;
    if (key === 'CLOUDINARY_TIMEOUT_MS') return 120_000;
    return undefined;
  }),
};

// We test only validateFile via a tiny subclass that exposes it.
class TestableUploadsService extends UploadsService {
  testValidate(file: Express.Multer.File) {
    // Access private method via bracket notation for testing
    (this as any).validateFile(file);
  }
}

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.alloc(1024),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('UploadsService.validateFile', () => {
  let service: TestableUploadsService;

  beforeEach(() => {
    service = new TestableUploadsService(null as any, mockConfig as any);
  });

  it('accepts all allowed MIME types', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(() =>
        service.testValidate(makeFile({ mimetype: mime })),
      ).not.toThrow();
    }
  });

  it('rejects an unsupported MIME type with code UNSUPPORTED_FILE_TYPE', () => {
    let err: any;
    try {
      service.testValidate(makeFile({ mimetype: 'image/gif' }));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()?.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects a file that exceeds MAX_FILE_SIZE_MB with code FILE_TOO_LARGE', () => {
    const oversized = makeFile({
      mimetype: 'application/pdf',
      size: 6 * 1024 * 1024, // 6 MB > 5 MB limit
    });
    let err: any;
    try {
      service.testValidate(oversized);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()?.code).toBe('FILE_TOO_LARGE');
  });

  it('accepts a file exactly at the size limit', () => {
    const exact = makeFile({
      mimetype: 'application/pdf',
      size: 5 * 1024 * 1024,
    });
    expect(() => service.testValidate(exact)).not.toThrow();
  });
});
