import { NgModule } from '@angular/core';
import { C360ContextService } from './src/c360-context.service';
import { C360ViewerComponent } from './src/c360-viewer.component';

@NgModule({
  declarations: [ C360ViewerComponent ],
  exports:      [ C360ViewerComponent ],
  providers:    [ C360ContextService ]
})
export class AngularC360Module { }

export { C360ContextService };
export * from './src/IModelAdapter';
export * from './src/UIAction';
export * from './src/UIMessage';
export * from './src/UIPart';
export * from './src/UIProperty';
