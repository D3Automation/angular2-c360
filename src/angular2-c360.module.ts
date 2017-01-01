import { NgModule, ModuleWithProviders } from '@angular/core';
import { C360ContextService } from './c360-context.service';
import { C360ViewerComponent } from './c360-viewer.component';
import { C360ContextServiceConfig } from './c360-context-service-config';
import { ModelAdapter } from './model-adapter';

@NgModule({
  declarations: [ C360ViewerComponent ],
  exports:      [ C360ViewerComponent ],
  providers:    [ C360ContextService ]
})
export class AngularC360Module {
  static forRoot(config: C360ContextServiceConfig, modelAdapter: ModelAdapter = null): ModuleWithProviders {
    var providers:Array<any> = [
      { provide: C360ContextServiceConfig, useValue: config }
    ];

    if (modelAdapter) {
      providers.push({ provide: ModelAdapter, useValue: modelAdapter })
    }

    return {
      ngModule: AngularC360Module,
      providers: providers
    };
  }
}
