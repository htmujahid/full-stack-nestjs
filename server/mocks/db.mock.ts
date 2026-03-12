import { DataSource } from 'typeorm';

/** Reusable mock repository returned by mockDataSource.getRepository() */
export const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  exists: jest.fn(),
});

/**
 * Mock TypeORM DataSource.
 * Use as a provider: { provide: DataSource, useValue: mockDataSource() }
 */
export const mockDataSource = (): jest.Mocked<
  Pick<DataSource, 'getRepository' | 'transaction'>
> => ({
  getRepository: jest.fn().mockReturnValue(mockRepository()),
  transaction: jest.fn().mockImplementation((cb) => cb(mockDataSource())),
});
