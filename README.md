# angular2-c360
Angular2 components and services for interacting with [Configurator 360](https://configurator360.autodesk.com).

By using [C360ContextService](src/c360-context.service.ts) to load a Configurator 360 model (either a new model or a saved model), you are given a javascript object representing the root part from your model.  This object contains a property for each child part, a property for each model property, and a function for each action (e.g. downloading drawings).  Each of the child parts contains all of this functionality as well -- all the way down the hierarchy.  This allows you to interact with your entire C360 model on the client side using javascript.

Once the C360 model has been retrieved, the client-side model is automatically kept in sync with the server-side model. When a [UIProperty](src/ui-property.ts) is updated on the client, the change
is automatically sent to the server, and any resultant changes (dependent properties, addition/removal of children, etc.) are returned and incorporated into the client-side model.  

_**NOTE:** An Angular 1 version of this library also exists and can be found [here](https://github.com/D3Automation/angular-c360)_

## Table of Contents
* [Demo](#demo)
* [Installation](#installation)
* [Common Usage](#common-usage)
* [Advanced Usage](#advanced-usage)
* [Inspecting Client-Side Model](#inspecting-client-side-model)
* [C360 Errors](#c360-errors)
* [Versioning](#versioning)
* [Authors](#authors)
* [License](#license)
* [API](API.md)

## Demo
A live sample application can be found [here](https://d3automation.github.io/angular2-c360-sample/).
The source code for this sample is in its [own repository](https://github.com/D3Automation/angular2-c360-sample), along with instructions for running the sample locally. 

## Installation
### Install library
Add the library to your project using npm:
```
npm install angular2-c360 --save
```

### Add C360 script from Autodesk to your index.html
```html
<script src="https://configurator360.autodesk.com/Script/v1/EmbeddedViewer"></script>
```

### Set design key
In order for angular2-c360 to know which design to use, we have to configure [C360ContextService](src/c360-context.service.ts) with the appropriate designKey when the application is bootstrapped.
The design key is the unique identifier for your design within C360 (i.e. all text to the right of the "https://configurator360.autodesk.com/" text in your C360 design URL).  This is accomplished
by passing an instance of [C360ContextServiceConfig](src/c360-context-service-config.ts) to [AngularC360Module](angular2-c360.ts).forRoot() when [AngularC360Module](angular2-c360.ts) is
imported into the application's root module.  More details can be found in [the official documentation for Angular Modules](https://angular.io/docs/ts/latest/guide/ngmodule.html#!#core-for-root).

Here is an example:
```typescript
@NgModule({
  imports: [
    BrowserModule,
    AngularC360Module.forRoot({designKey: "575458448649916390/2gn1dj1tslb4"})
  ],
  declarations: [
    AppComponent
  ]
  bootstrap: [ AppComponent ]
})
export class AppModule { }
```

## Common Usage
_Note: Code samples shown below adhere to the [Angular Style Guide](https://angular.io/docs/ts/latest/guide/style-guide.html) on the official Angular site._

### Loading Model
* In the component in which you will use the C360 model, inject `c360Context`.
* Call `c360Context.getNewModel()`, which returns a promise containing the root part.
* In order to prevent reloading the model every time the component is activated, `c360Context.isModelLoaded()` can be evaluated first

Example:
```typescript
import { Component, OnInit } from '@angular/core';
import { C360ContextService, UIPart } from 'angular2-c360';

@Component({
  selector: 'app-model-simple',
  templateUrl: './model-simple.component.html',
  styleUrls: ['./model-simple.component.css']
})
export class ModelSimpleComponent implements OnInit {

  constructor(private c360Context: C360ContextService) { }

  public rootPart: UIPart;

  ngOnInit() {
    if (this.c360Context.isModelLoaded()) {
      this.rootPart = this.c360Context.getRoot();
    }
    else {
      this.c360Context.getNewModel()
        .then(root => {
          this.rootPart = root
        });
    }
  }
}
```

See the [C360 Errors](#c360-errors) section below for details on error handling.

### Creating Inputs for Properties
#### Bindings
Each [UIProperty](src/ui-property.ts) has several properties containing metadata from the C360 model that reflect how the property
should behave in the UI.  By binding your HTML elements to these properties, your component can automatically update itself using
logic driven by your C360 model.   

##### Input
Here is an example of binding various attributes of an `<input>` element to a [UIProperty](src/ui-property.ts):
```html
<input #i (blur)="rootPart.SomeProperty.value=i.value" [value]="rootPart.SomeProperty.value" placeholder="{{rootPart.SomeProperty.fullName}}"
    [class.c360-modified]="rootPart.SomeProperty.isModified" [class.c360-invalid]="rootPart.SomeProperty.errorInfo" 
    [disabled]="rootPart.SomeProperty.isReadOnly" [type]="rootPart.SomeProperty.inputType" />
```

Note: In order to prevent updating the C360 model on every keystroke, the `blur` attribute was used, along with a [template reference variable](https://angular.io/docs/ts/latest/guide/template-syntax.html#!#ref-vars)
rather than the [standard `[(ngModel)]` method of two-way data-binding](https://angular.io/docs/ts/latest/guide/forms.html).

#### Select
Here is an example of binding various attributes of a `<select>` element to a [UIProperty](src/ui-property.ts):
```html
<select [(ngModel)]="rootPart.SomeProperty.value">
    <option *ngFor="let choice of rootPart.SomeProperty.choiceList" [value]="choice.value">
        {{choice.text}}
    </option>
</select>
```

#### Creating Reusable Component
Although the above syntax is relatively straightforward, it is pretty verbose.  Using this syntax for every property in your application
will quickly clutter your application and make it difficult to maintain.  The solution is to create a custom Angular component that can then be used
throughout your application.

An example of this is the [`<c360-prop>`](https://github.com/D3Automation/angular2-c360-sample/blob/master/src/app/c360-prop/c360-prop.component.html) component, which
can be found in the [angular2-c360-sample](https://github.com/D3Automation/angular2-c360-sample) repository.  The [`<c360-prop>`](https://github.com/D3Automation/angular2-c360-sample/blob/master/src/app/c360-prop/c360-prop.component.html) component
accepts a [UIProperty](src/ui-property.ts) as an input, and it dynamically renders an `<input>` or `<select>` bound to that property -- depending on how the property
is defined in the C360 model.

Note: The [`<c360-prop>`](https://github.com/D3Automation/angular2-c360-sample/blob/master/src/app/c360-prop/c360-prop.component.html) mentioned above has a dependency
on [Bootstrap 4](https://v4-alpha.getbootstrap.com/).

#### Future Plans
Ideally, it wouldn't require fully implementing a custom component in order to encapsulate the template to be used for [UIProperty](src/ui-property.ts) objects
in your application.  In the [Angular 1 version of this library](https://github.com/D3Automation/angular-c360), an implementation of [`<c360-prop>` is provided](https://github.com/D3Automation/angular-c360/blob/master/directives/c360Prop.directive.js)
as part of the library.  It is then possible to override just the template for the directive (via configuration) without having to implement a fully custom directive.

Angular 2 does not currently support this, but there is already an [issue requesting this functionality](https://github.com/angular/angular/issues/11144), so hopefully
this will be possible at some point.

### Executing Actions (e.g. downloading drawings)
As mentioned above, all actions defined on a given part in your C360 model are available in the client-side model as functions on that part.  Executing an action is as simple as calling one of those functions.
The simplest way to do this is to bind the action to the `click` event of a button:
```html
<button (click)="rootPart.CreateDrawingDWG()">Download DWG</button>
```

### Graphics
Adding the graphics viewer is as simple as adding a viewer element:
    
```html
<c360-viewer></c360-viewer>
```  
    
There is no interactibility with the actual viewer, it's just plug and play.

## Advanced Usage
### Get Part By Refchain
Assuming `c360Context` is an object of type `C360ContextService`, the following can be used to retrieve a specific `UIPart`
from the client-side model:

```typescript
let part: UIPart = c360Context.getPartByRefChain('Root.Foo.Bar');
``` 

This returns the UIPart at the given refChain, in this case, the UIPart `Bar` which is a child of `Foo`

### Interacting With Model in Typescript/Javascript
Once you have a reference to a part within your component (see above for how to get root part and/or get a specific part by Refchain), you can evaluate/set properties and execute actions on parts anywhere in the model hierarchy.

#### Evaluating / Setting Properties
Assuming you already have a variable named `rootPart` that references the root part of your model, the following code will evaluate (and potentially set) a property on a child part:
```typescript   
if (rootPart.SomeChild.SomeGrandchild.PartNumber.value !== null) {
    alert('The part number is ' + rootPart.SomeChild.SomeGrandchild.PartNumber.value);
} else {
    rootPart.SomeChild.SomeGrandchild.PartNumber.value = 'PT-15';
}
```

In the above example, the code sets the PartNumber property if it is not already set.  However, since this is an asynchronous call to the server (which returns a `Promise`), any code after the property is set will execute immediately rather than waiting on the update to finish.  In order to add code after the asynchronous call, the following approach can be used (assuming `c360Context` is an object of type `C360ContextService`):

```typescript
c360Context.updateProperty('Root.SomeChild.SomeGrandchild', 'uiPartNumber', 'PT-15')
    .then(function() {
        alert('The PartNumber property was successfully set');
    })
    .catch(function() {
        alert('An error occurred while setting the PartNumber property');
    });
```

#### Evalating other attributes of the C360 property object 
There are many more properties on the object created from the UIProperty, including choiceList, dataType, uiRuleName and more. For more, you can reference the [ui-property.ts](src/ui-property.ts) file.    

#### Executing Actions
Actions appear as functions on the root part and all of its children, all the way down the hierarchy, so they can be called just like calling any existing javascript function.

Here is an example of executing an action within a component:
```typescript
import { Component, OnInit } from '@angular/core';
import { C360ContextService, UIPart } from 'angular2-c360';

@Component({
  selector: 'app-model-simple',
  templateUrl: './model-simple.component.html',
  styleUrls: ['./model-simple.component.css']
})
export class ModelSimpleComponent implements OnInit {

  constructor(private c360Context: C360ContextService) { }

  public rootPart: any;

  downloadDrawings() {
    this.rootPart.CreateDrawingDWG()
      .then(() => {
        // The action returns a promise, so put any logic here
        //  that you would like to execute after the action completes
      });
  }

  ngOnInit() {
    if (this.c360Context.isModelLoaded()) {
      this.rootPart = this.c360Context.getRoot();
    }
    else {
      this.c360Context.getNewModel()
        .then(root => {
          this.rootPart = root
        });
    }
  }
}
```

See the [C360 Errors](#c360-errors) section below for details on error handling.

### Custom Model Adapter
When the client-side model is updated after each call to the server, we have the ability to affect how the model is created by using a model adapter object.  The default model adapter can be found in [model-adapter.ts](src/model-adapter.ts).

By creating a custom model adapter, we can override the logic used for the following:
* **Replacing invalid characters in property names**
    * The base name for a property in a C360 model can contain characters that are not valid in property names in javascript
    * For example, a property in C360 might be named "Scrap %".  Neither the space nor the % can be used in a javascript property name, so they need to be replaced when the client-side model is created.
    * By default, an empty string will be used as the replacement
* **Executing custom javascript for every part that is returned from the server**
    * One example would be to log some information about each part
    * Another example is to actually modify some of the parts in some way in order to facilitate some special logic in the UI

Here is an example of a custom model adapter that overrides `visitPart` to log the name of each `UIPart` that has been updated:
```typescript
import { ModelAdapter, UIPart } from 'angular2-c360';

export class LoggingModelAdapter extends ModelAdapter {
    visitPart(part: UIPart) {
        console.log(part.refChain);
    }    
}
```

In order to use this custom model adapter, you simply pass an instance of it into `AngularC360Module.forRoot()`, along with the `C360ContextServiceConfig` object
that was mentioned above:

```typescript
@NgModule({
  imports: [
    BrowserModule,
    AngularC360Module.forRoot({designKey: "575458448649916390/2gn1dj1tslb4"}, new LoggingModelAdapter())
  ],
  declarations: [
    AppComponent
  ]
  bootstrap: [ AppComponent ]
})
export class AppModule { }
``` 

### Accessing the C360 viewer object directly
With **angular2-c360**, we have exposed and streamlined a set of functions we think should give you the ability to do almost everything needed in typical usage scenarios. All of this functionality exists in `C360ContextService`. For anything else, you can directly retrieve the viewer object (`C360ContextService.getViewer()`), and you'll have complete access to the functionality provided by C360.

[Autodesk documentation for C360 Viewer](http://help.autodesk.com/view/CFG360/ENU/?guid=GUID-82310904-D89F-46B6-A1D2-8E5F07333DA3) 

## Inspecting Client-Side Model
Once the client-side model has been created by `C360ContextService`, it is pretty handy to be able to inspect the model object.  This makes it easier to see what properties, children, and actions are available on each part without having to refer back to the C360 designs.
The easiest way to do this is by using the [Angular Augury](https://augury.angular.io/) extension for Google Chrome.  Once this extension is installed, you are able to see
a visual representation of the component tree for your application. As you click on each component, you are then able to view details about the component, as well as interact
with the component from the console (it is available as `$a` from the console).  So, once you've clicked on a component that injects `C360ContextService`, executing the following
statement from the console will return the root `UIPart` from the client-side model:

```javascript
$a.componentInstance.c360Context.rootPart
```

## C360 Errors
### Resolving Error Name From Error Code
If an error occurs while loading the model, the error code will be passed in to the `catch` method of the promise.  The error code can then be
compared to the [`ADSK.C360.loadedState`](http://help.autodesk.com/view/CFG360/ENU/?guid=GUID-1A1B61D7-0453-4B76-B0D2-E9D2F3107036) enumeration to
determine the type of error.

### Common Errors
#### ADSK.C360.loadedState.Forbidden (403)
This error occurs when the URL for your site has not been added under the  **_Allow these authorized sites to embed configuration pages of my designs_** page under Options/Embedding for the C360 account
that owns the design your application is configured to use.

This will **_always_** occur if you are using **_localhost_** in your URL.  If your application is running on your local machine, you will
need to use **http://127.0.0.1** rather than http://localhost.  You will also still need to add http://127.0.0.1 as an authorized site. 

#### ADSK.C360.loadedState.DesignOpenInOtherWindowOrTab (12)
This error occurs when you attempt to load a C360 design in a browser tab while you already have the same design opened in another tab of the same
browser.  Due to the way C360 handles sessions, using a different browser altogether is the only way to use multiple instances of the same design
simultaneously.

## Versioning
We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/D3Automation/angular2-c360/tags). 

## Authors
* [D3 Automation](http://d3tech.net/solutions/automation/)

See also the list of [contributors](https://github.com/D3Automation/angular2-c360/contributors) who participated in this project.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details