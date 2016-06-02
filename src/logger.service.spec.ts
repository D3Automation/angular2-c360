import {
  beforeEachProviders,
  it,
  describe,
  expect,
  inject
} from '@angular/core/testing';
import { Logger } from './logger.service';

describe('Logger Service', () => {
  beforeEachProviders(() => [Logger]);

  it('should ...',
      inject([Logger], (service: Logger) => {
    expect(service).toBeTruthy();
  }));
});
