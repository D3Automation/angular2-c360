import {
  beforeEachProviders,
  it,
  describe,
  expect,
  inject
} from '@angular/core/testing';
import { C360ContextService } from './c360-context.service';

describe('C360Context Service', () => {
  beforeEachProviders(() => [C360ContextService]);

  it('should ...',
      inject([C360ContextService], (service: C360ContextService) => {
    expect(service).toBeTruthy();
  }));
});
