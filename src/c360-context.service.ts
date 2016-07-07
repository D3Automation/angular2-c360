import { Injectable, OnInit } from '@angular/core';
import { Observable } from 'rxjs/observable';
import 'rxjs/add/operator/take';
import { Subject } from 'rxjs/subject';
import { ReplaySubject } from 'rxjs/replaysubject';
import { UIPart } from './UIPart';
import { UIProperty } from './UIProperty';
import { IModelAdapter } from './IModelAdapter';
import { DefaultModelAdapter } from './DefaultModelAdapter';
import { ViewerDivId } from './constants';

declare var ADSK: any;

@Injectable()
export class C360ContextService {
    private designKey: string = undefined;        
    private modelAdapter: IModelAdapter = new DefaultModelAdapter();
    private actionParamsPropName: string = "uiActionParams";

    private rootPart: UIPart = null;
    private updateInProgress: boolean = false;
    private dirty: boolean = false;
    private invalidCharacterPattern: RegExp = /[\s\%\/\?\)\(\.\']/g;
    private parts: Map<string, UIPart> = new Map<string, UIPart>();
    private viewer: any = null;
    private lastError: any = null;

    model: Subject<UIPart> = this.createModelSubject();
    modelActivities: Subject<Observable<any>> = new Subject<Observable<any>>();

    getNewModel(): Observable<UIPart> {
        return this.initializeViewer();
    }

    loadModel(modelBlob: any): Observable<UIPart> {
        return this.initializeViewer(modelBlob);
    }

    getRoot(): UIPart {
        return this.rootPart;
    }

    getParts(): Array<UIPart> {
        return Array.from(this.parts.values());
    }

    getPartByRefChain(refChain): UIPart {
        return this.parts.get(refChain);
    }

    updateProperty(refChain, name, value): Observable<void> {
        return this.updateProperties({
            refChain: refChain,
            properties: [
                {
                    name: name,
                    value: value
                }
            ]
        });
    }

    updateProperties(properties: any): Observable<void> {
        let propSubject = new Subject<void>();
        this.modelActivities.next(propSubject);

        if (this.updateInProgress) {
            propSubject.error('Unable to update model properties while an update is already in progress');
            return propSubject;
        }

        this.updateInProgress = true;      

        this.viewer.setPropertyValues(properties, modelData => {
            try {
                this.updateModel(modelData);
                this.setDirty(true);
                propSubject.complete();
            } catch (error) {
                propSubject.error(error);
            } finally {
                this.updateInProgress = false;      
            }
        }, err => {
            this.updateInProgress = false;      
            propSubject.error(err);
        });
        
        return propSubject;
    }

    resetProperty(refChain, name): Observable<void> {
        return this.updateProperty(refChain, name, null);
    }

    executeAction(actionParams): Observable<any> {
        let actionSubject = new Subject<any>();
        this.modelActivities.next(actionSubject);
        
        if (this.updateInProgress) {
            actionSubject.error('Unable to execute action while an update is already in progress');
            return actionSubject;
        }

        this.updateInProgress = true;
        
        if (actionParams.params) {
            let actionParamPropData = {};
            actionParamPropData[this.actionParamsPropName] = JSON.stringify(actionParams.params);
            this.viewer.setPropertyValues(actionParamPropData,
                () => this.finishExecuteAction(actionParams, actionSubject),
                err => actionSubject.error(err));
        }
        else {
            this.finishExecuteAction(actionParams, actionSubject);
        }

        return actionSubject;
    }

    endSession() {
        if (this.model) {
            this.model.complete();
            this.model = undefined;
        }
        this.clearModel();
    }

    get isDirty(): boolean {
        return this.dirty;
    }

    isModelLoaded() {
        return (this.rootPart !== null);
    }

    // TODO: Handle setDesignKey with DI
    setDesignKey(designKey: string) {
        this.designKey = designKey;
    }

    // TODO: Handle setModelAdapter with DI
    setModelAdapter(modelAdapter: IModelAdapter) {
        this.modelAdapter = modelAdapter;
    }

    getViewer() {
        return this.viewer;
    }

    getLastError() {
        return this.lastError;
    }

    private initializeViewer(modelBlob?): Observable<UIPart> {
        if (!this.model) { this.model = this.createModelSubject();}

        if (!this.designKey) {
            this.model.error("Must set C360 design key");
            return this.model;
        }

        let viewerElement = document.getElementById(ViewerDivId);
        if (!viewerElement) {
            viewerElement = document.createElement("div");
            viewerElement.setAttribute("id", ViewerDivId);
            
            document.body.insertAdjacentElement("afterbegin", viewerElement);
        }
        viewerElement.style.position = "absolute";
        viewerElement.style.zIndex = "-1";

        this.clearModel();

        let viewerLoaded = (viewer) => {
            this.viewer = viewer;
            this.viewer.getPropertyValues(null, (modelData) => {
                this.updateModel(modelData);
                this.model.next(this.rootPart);
            });
        };

        let failedToLoad = (viewer) => {
            this.viewer = viewer;
            this.model.error(viewer.state);
        }

        let viewerOptions = {
            container: viewerElement,
            design: this.designKey,
            panes: false,
            success: viewerLoaded,
            error: failedToLoad,
            verbose: true,
            openFromFile: null
        }

        if (modelBlob) {
            viewerOptions.openFromFile = modelBlob;
        }

        // Check client compatibility and load the viewer if compatible.
        let c360 = window.ADSK && window.ADSK.C360;
        c360.checkCompatibility((result) => {
            if (result.compatible) {
                c360.initViewer(viewerOptions);
            } else {
                this.lastError = result.reason;
                this.model.error(result.reason);
            }
        });

        this.modelActivities.next(this.model.take(1));

        return this.model;
    }

    private createModelSubject(): Subject<UIPart> {
        return new ReplaySubject<UIPart>(1);        
    }

    private updateModel(modelData) {
        this.clearLastError();
        this.mergePart(modelData, modelData.parentRefChain);

        // Detach deleted entities
        if (modelData.removedRefChains) {
            modelData.removedRefChains.forEach((refChain) => {
                let partToRemove = this.getPartByRefChain(refChain);
                if (partToRemove) {
                    if (partToRemove.Parent && partToRemove.Parent.hasOwnProperty(partToRemove.Name)) {
                        delete partToRemove.Parent[partToRemove.Name];
                    }

                    this.parts.delete(partToRemove.RefChain);
                }
            })
        }

        // Post-process parts (add shortcut properties, action methods, etc.)
        this.processParts(this.getParts());
    }

    private mergePart(part: any, parentRefChain?: string) {
        let ctx = this;        
        let isCompleteChangedPart = (part.isCompleteChangedPart == true);
        let mergedPart: UIPart;

        if (this.parts.get(part.refChain)) {
            mergedPart = this.parts.get(part.refChain);

            // Remove functions on existing part that executed each action
            mergedPart.Actions.forEach(a => delete mergedPart[a.Name]);
        } else {
            mergedPart = new UIPart();
            mergedPart.RefChain = part.refChain;
            this.parts.set(mergedPart.RefChain, mergedPart);
        }

        mergedPart.Name = part.Name;
        mergedPart.PartType = part.PartType;

        if (parentRefChain && this.parts.get(parentRefChain)) {
            mergedPart.Parent = this.parts.get(parentRefChain);
        }

        if (!mergedPart.UIProperties || isCompleteChangedPart) {
            mergedPart.UIProperties = [];
        }

        if (part.properties) {
            part.properties.forEach(prop => {
                // TODO - Optimize this so that the first time a part is added its properties aren't searched
                if (!isCompleteChangedPart) {
                    for (var i = 0, len = mergedPart.UIProperties.length; i < len; i++) {
                        if (mergedPart.UIProperties[i].fullName === prop.value.FullName) {
                            mergedPart.UIProperties.splice(i, 1);
                            break;
                        }
                    }
                }

                mergedPart.UIProperties.push(new UIProperty(this, mergedPart, prop.value));
            });
        }

        mergedPart.Messages = (part.Messages) ? part.Messages : [];
        mergedPart.Actions = (part.Actions) ? part.Actions : [];

        // TODO: Children array could probably be handled more efficiently
        mergedPart.Children = [];
        if (part.children) {
            part.children.forEach((child) => {
                mergedPart.Children.push(ctx.mergePart(child, part.refChain));
            });
        }

        return mergedPart;
    }

    private processParts(parts) {
        // First pass is to watch for root and add some shortcuts
        parts.forEach((part) => this.processPart(part));

        // Now allow for custom processing
        parts.forEach((part) => this.modelAdapter.visitPart(part));
    }
    
    private processPart(part) {
        let ctx = this;

        if (part.RefChain === 'Root') {
            ctx.rootPart = part;
        }

        let propSuffix = '_Prop';

        // Remove all existing UIProperty properties from the part
        Object.getOwnPropertyNames(part).forEach((propName) => {
            if (propName.endsWith(propSuffix)) {
                var propNameNoSuffix = propName.replace(propSuffix, '');
                delete part[propNameNoSuffix];
                delete part[propName];
            }
        });

        // Add properties for each UI Property and reset function on each UI Property
        part.UIProperties.forEach((uiProp) => {
            let valuePropName = uiProp.fullName.replace(ctx.invalidCharacterPattern, ctx.modelAdapter.invalidCharacterReplacement);

            // Add property that points to UI Property's value
            Object.defineProperty(part, valuePropName, {
                get: function () {
                    return uiProp.value;
                },
                set: function (newValue) {
                    uiProp.value = newValue;
                },
                enumerable: true,
                configurable: true
            });

            // Add another property that points to the UI Propert itself
            let propPropName = valuePropName + propSuffix;
            part[propPropName] = uiProp;
        });

        // Add properties as shortcuts to each child
        part.Children.forEach((uiChild) => {
            let childName = uiChild.Name.replace(ctx.invalidCharacterPattern, ctx.modelAdapter.invalidCharacterReplacement);

            Object.defineProperty(part, childName, {
                get: function () {
                    return uiChild;
                },
                enumerable: true,
                configurable: true
            });
        });

        // Add shortcut to collection's children if applicable
        if (ctx.modelAdapter.isPartCollection(part)) {
            let collectionName = ctx.modelAdapter.parseCollectionName(part.Name);

            Object.defineProperty(part.Parent, collectionName, {
                get: function () {
                    return part.Children;
                },
                enumerable: true,
                configurable: true
            });
        }

        if (part.Actions) {
            part.Actions.forEach((action) => {
                part[action.Name] = function (params) {
                    let actionData = {
                        refChain: part.RefChain,
                        name: action.Name,
                        params: params
                    };

                    return ctx.executeAction(actionData);
                };
            });
        }
    }

    private finishExecuteAction(actionParams: any, subject: Subject<any>): void {
        this.viewer.executeAction(actionParams, result => {
            this.updateInProgress = false;
            
            if (result.url) {
                // Download output
                let iframe = document.createElement("iframe");
                iframe.setAttribute("src", result.url);
                iframe.style.display = "none";
                document.body.insertAdjacentElement("beforeend", iframe);

                setTimeout(function() {
                    iframe.remove();    
                }, 1000);                       
            }
            else if (result.title && result.message) {
                let message = null;

                try {
                    message = JSON.parse(result.message);
                } catch (e) {
                    message = result.message;
                }

                subject.next(message);
            }
            else {
                this.updateModel(result);
                this.setDirty(true);
            }

            subject.complete();
        }, err => {
            this.updateInProgress = false;
            subject.error('Error occurred while executing action ' + actionParams.name);
        });
    }

    private clearModel() {
        this.rootPart = null;
        this.parts.clear();
        this.clearLastError();
        this.setDirty(false);

        if (this.viewer) {
            this.viewer.unload();
            this.viewer = null;
        }
    }

    private setDirty(dirty: boolean) {
        this.dirty = dirty;
    }

    private onSessionEnded() {
        this.onModelClosed();
    }

    private onModelClosed() {
        this.clearModel();
    }

    private clearLastError() {
        this.lastError = null;
    }
  }
