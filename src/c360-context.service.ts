import { Injectable, OnInit, Optional } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs/Rx';
import { UIAction } from './ui-action';
import { UIMessage } from './ui-message';
import { UIPart } from './ui-part';
import { UIProperty } from './ui-property';
import { C360ContextServiceConfig } from './c360-context-service-config';
import { ModelAdapter } from './model-adapter';
import { ViewerDivId } from './constants';

@Injectable()
export class C360ContextService {
    private designKey: string = undefined;        
    private modelAdapter: ModelAdapter;
    private actionParamsPropName: string = "uiActionParams";

    private rootPart: UIPart = null;
    private updateInProgress: boolean = false;
    private dirty: boolean = false;
    private invalidCharacterPattern: RegExp = /[\s\%\/\?\)\(\.\']/g;
    private parts: Map<string, UIPart> = new Map<string, UIPart>();
    private viewer: any = null;
    private lastError: any = null;

    constructor(config: C360ContextServiceConfig, @Optional() modelAdapter: ModelAdapter) {
        this.designKey = config.designKey;
        this.modelAdapter = (modelAdapter) ? modelAdapter : new ModelAdapter();
    }

    model: Subject<UIPart> = new BehaviorSubject<UIPart>(null);
    busy: Subject<boolean> = new BehaviorSubject<boolean>(false);

    getNewModel(): Promise<UIPart> {
        return this.initializeViewer();
    }

    loadModel(modelBlob: any): Promise<UIPart> {
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

    updateProperty(refChain, name, value): Promise<void> {
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

    updateProperties(properties: any): Promise<void> {
        let promise = new Promise<void>((resolve, reject) => {
            if (this.updateInProgress) {
                reject('Unable to update model properties while an update is already in progress');
            }

            this.busy.next(true);
            this.updateInProgress = true;      

            this.viewer.setPropertyValues(properties, modelData => {
                try {
                    this.updateModel(modelData);
                    this.setDirty(true);
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    this.updateInProgress = false;      
                    this.busy.next(false);
                }
            }, err => {
                this.updateInProgress = false;      
                this.busy.next(false);
                reject(err);
            });
        });

        return promise;
    }

    resetProperty(refChain, name): Promise<void> {
        return this.updateProperty(refChain, name, null);
    }

    executeAction(actionParams): Promise<any> {
        let promise = new Promise<any>((resolve, reject) => {
            if (this.updateInProgress) {
                reject('Unable to execute action while an update is already in progress');
            }

            this.busy.next(true);
            this.updateInProgress = true;      

            if (actionParams.params) {
                let actionParamPropData = {};
                actionParamPropData[this.actionParamsPropName] = JSON.stringify(actionParams.params);
                this.viewer.setPropertyValues(actionParamPropData,
                    () => this.finishExecuteAction(actionParams, resolve, reject),
                    err => reject(err));
            }
            else {
                this.finishExecuteAction(actionParams, resolve, reject);
            }
        });
                
        return promise;
    }

    endSession() {
        this.model.next(null);
        this.clearModel();
    }

    get isDirty(): boolean {
        return this.dirty;
    }

    isModelLoaded() {
        return (this.rootPart !== null);
    }

    getViewer() {
        return this.viewer;
    }

    getLastError() {
        return this.lastError;
    }

    private initializeViewer(modelBlob?): Promise<UIPart> {
        return new Promise<UIPart>((resolve, reject) => {
            if (!this.designKey) {
                reject("Must set C360 design key");
            }

            this.busy.next(true);
            this.clearModel();
        
            let viewerElement = document.createElement("div");
            viewerElement.setAttribute("id", ViewerDivId);        
            document.body.insertBefore(viewerElement, document.body.firstChild);
            viewerElement.style.position = "absolute";
            viewerElement.style.zIndex = "-1";

            let viewerLoaded = (viewer) => {
                this.viewer = viewer;
                this.viewer.getPropertyValues(null, (modelData) => {
                    this.updateModel(modelData);
                    this.model.next(this.rootPart); 
                    this.busy.next(false);
                    resolve(this.rootPart);               
                });
            };

            let failedToLoad = (viewer) => {
                this.viewer = viewer;
                reject(viewer.state);
                this.busy.next(false);
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
                    this.busy.next(false);
                    reject(result.reason);
                }
            });
        });
    }

    private updateModel(modelData) {
        this.clearLastError();
        this.handleDeletedParts(modelData.removedRefChains);
        this.mergePart(modelData, modelData.parentRefChain);

        // Post-process parts (add shortcut properties, action methods, etc.)
        this.processParts(this.getParts());
    }

    private handleDeletedParts(removedRefChains: Array<string>) {
        if (!removedRefChains) {
            return;
        }

        removedRefChains.forEach((refChain) => {
            let partToRemove = this.getPartByRefChain(refChain);
            if (partToRemove) {
                let propName = this.ensureValidPropertyName(partToRemove.name);
                if (partToRemove.parent && partToRemove.parent.hasOwnProperty(propName)) {
                    delete partToRemove.parent[propName];
                    partToRemove.parent.removeChild(partToRemove.refChain);
                }

                this.parts.delete(partToRemove.refChain);
            }
        })
    }

    private mergePart(part: any, parentRefChain?: string) {
        let isCompleteChangedPart: boolean = (part.isCompleteChangedPart == true);
        let isNewPart: boolean = true;
        let mergedPart: UIPart;

        if (this.parts.get(part.refChain)) {
            isNewPart = false;
            mergedPart = this.parts.get(part.refChain);

            // Remove functions on existing part that executed each action
            mergedPart.actions.forEach(a => delete mergedPart[a.name]);

            // Remove properties that point to UIProperties
            mergedPart.uiProperties.forEach(p => delete mergedPart[p.fullName]);
        } else {
            mergedPart = new UIPart();
            mergedPart.refChain = part.refChain;
            this.parts.set(mergedPart.refChain, mergedPart);
        }

        mergedPart.name = part.Name;
        mergedPart.partType = part.PartType;

        if (parentRefChain && this.parts.get(parentRefChain)) {
            mergedPart.parent = this.parts.get(parentRefChain);
        }

        if (!mergedPart.uiProperties || isCompleteChangedPart) {
            mergedPart.uiProperties = [];
        }

        if (part.properties) {
            part.properties.forEach(prop => {
                if (!(isCompleteChangedPart || isNewPart)) {
                    mergedPart.removeUIProperty(prop.value.FullName);
                }

                mergedPart.uiProperties.push(new UIProperty(this, mergedPart, prop.value));
            });
        }
        
        if (part.Messages) {
            mergedPart.messages = part.Messages.map(m => {
                return <UIMessage>{ messageText: m.MessageText, severity: m.Severity };
            });
        }
        else {
            mergedPart.messages = [];
        }

        if (part.Actions) {
            mergedPart.actions = part.Actions.map(a => {
                return <UIAction>{ name: a.Name, category: a.Category, menuText: a.MenuText, tooltip: a.tooltip };
            });
        }
        else {
            mergedPart.actions = [];
        }

        if (part.children) {
            part.children.forEach((child) => {
                let mergedChild = this.mergePart(child, part.refChain);

                if (!mergedPart.hasChild(part.refChain)) {
                    mergedPart.children.push(mergedChild);
                }                
            });
        }

        return mergedPart;
    }

    private processParts(parts: Array<UIPart>) {
        // First pass is to watch for root and add some shortcuts
        parts.forEach((part) => this.processPart(part));

        // Now allow for custom processing
        parts.forEach((part) => this.modelAdapter.visitPart(part));
    }
    
    private processPart(part: UIPart) {
        if (part.refChain === 'Root') {
            this.rootPart = part;
        }

        // Add properties for each UI Property
        part.uiProperties.forEach((uiProp) => {
            let valuePropName = this.ensureValidPropertyName(uiProp.fullName);
            part[valuePropName] = uiProp;
        });

        // Add properties as shortcuts to each child
        part.children.forEach((uiChild) => {
            let childName = this.ensureValidPropertyName(uiChild.name);

            Object.defineProperty(part, childName, {
                get: function () {
                    return uiChild;
                },
                enumerable: true,
                configurable: true
            });
        });

        // Add shortcut to collection's children if applicable
        if (this.modelAdapter.isPartCollection(part)) {
            let collectionName = this.modelAdapter.parseCollectionName(part.name);

            Object.defineProperty(part.parent, collectionName, {
                get: function () {
                    return part.children;
                },
                enumerable: true,
                configurable: true
            });
        }

        // Add functions to execute each action
        if (part.actions) {
            let ctx = this;

            part.actions.forEach((action) => {
                part[action.name] = function (params) {
                    let actionData = {
                        refChain: part.refChain,
                        name: action.name,
                        params: params
                    };

                    return ctx.executeAction(actionData);
                };
            });
        }
    }

    private finishExecuteAction(actionParams: any, resolve: (value?: any) => void, reject: (reason?: any) => void): void {
        this.viewer.executeAction(actionParams, result => {
            this.updateInProgress = false;
            this.busy.next(false);

            let value: any = null;

            if (result.url) {
                // Download output
                let iframe = document.createElement("iframe");
                iframe.setAttribute("src", result.url);
                iframe.style.display = "none";
                document.body.appendChild(iframe);

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

                value = message;
            }
            else {
                this.updateModel(result);
                this.setDirty(true);
            }

            resolve(value);
        }, err => {
            this.updateInProgress = false;
            this.busy.next(false);
            reject('Error occurred while executing action ' + actionParams.name);
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

        let viewerElement = document.getElementById(ViewerDivId);
        if (viewerElement) {
            viewerElement.remove();
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

    private ensureValidPropertyName(input: string): string {
        return input.replace(this.invalidCharacterPattern, this.modelAdapter.invalidCharacterReplacement);
    }
}
