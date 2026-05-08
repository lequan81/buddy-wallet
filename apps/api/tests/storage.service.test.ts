import { describe, expect, test } from 'bun:test';
import { createStorageService } from '@/modules/storage/services/s3.service';
import { validateFileSignature } from '@/modules/storage/services/storage.service';

const mockS3Client = {
	write: async () => undefined,
	delete: async () => undefined,
	file: () => ({
		exists: async () => true,
		arrayBuffer: async () => new ArrayBuffer(0)
	})
} as unknown as Bun.S3Client;

describe('storage service security', () => {
	test('rejects traversal segments in storage paths', () => {
		const service = createStorageService(mockS3Client, 'uploads', 'test-bucket');
		expect(() => service.resolvePath('../etc/passwd')).toThrow('Path traversal detected');
		expect(() => service.resolvePath('%2e%2e%2fsecret.txt')).toThrow('Path traversal detected');
	});

	test('rejects content type spoofing by signature', () => {
		const plainTextBuffer = Buffer.from('not-an-image', 'utf8');
		const result = validateFileSignature(plainTextBuffer, 'image/png');
		if ('code' in result) {
			expect(result.code).toBeDefined();
		} else {
			throw new Error('Expected error result but got success');
		}
	});
});
