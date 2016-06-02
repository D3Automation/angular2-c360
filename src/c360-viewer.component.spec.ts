import {
  beforeEach,
  beforeEachProviders,
  describe,
  expect,
  it,
  inject,
} from '@angular/core/testing';
import { ComponentFixture, TestComponentBuilder } from '@angular/compiler/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { C360ViewerComponent } from './c360-viewer.component';

describe('Component: C360Viewer', () => {
  let builder: TestComponentBuilder;

  beforeEachProviders(() => [C360ViewerComponent]);
  beforeEach(inject([TestComponentBuilder], function (tcb: TestComponentBuilder) {
    builder = tcb;
  }));

  it('should inject the component', inject([C360ViewerComponent],
      (component: C360ViewerComponent) => {
    expect(component).toBeTruthy();
  }));

  it('should create the component', inject([], () => {
    return builder.createAsync(C360ViewerComponentTestController)
      .then((fixture: ComponentFixture<any>) => {
        let query = fixture.debugElement.query(By.directive(C360ViewerComponent));
        expect(query).toBeTruthy();
        expect(query.componentInstance).toBeTruthy();
      });
  }));
});

@Component({
  selector: 'test',
  template: `
    <app-c360-viewer></app-c360-viewer>
  `,
  directives: [C360ViewerComponent]
})
class C360ViewerComponentTestController {
}

