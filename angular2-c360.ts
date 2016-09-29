import { NgModule, ModuleWithProviders } from '@angular/core';
import { C360ContextService } from './src/c360-context.service';
import { C360ViewerComponent } from './src/c360-viewer.component';
import { C360ContextServiceConfig } from './src/C360ContextServiceConfig';
import { ModelAdapter } from './src/ModelAdapter';

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

export { C360ContextService };
export * from './src/ModelAdapter';
export * from './src/UIAction';
export * from './src/UIMessage';
export * from './src/UIPart';
export * from './src/UIProperty';
