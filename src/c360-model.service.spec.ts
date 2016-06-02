import {
  beforeEachProviders,
  it,
  describe,
  expect,
  inject
} from '@angular/core/testing';
import { C360Model } from './c360-model.service';

describe('C360Model Service', () => {
  beforeEachProviders(() => [C360Model]);

  it('should ...',
      inject([C360Model], (service: C360Model) => {
    expect(service).toBeTruthy();
  }));
});
