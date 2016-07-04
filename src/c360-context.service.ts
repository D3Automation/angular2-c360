import { Injectable, OnInit } from '@angular/core';
import { UIPart } from './UIPart';
import { IModelAdapter } from './IModelAdapter';
import { DefaultModelAdapter } from './DefaultModelAdapter';
import { Constants } from './Constants';

declare var ADSK: any;

@Injectable()
export class C360ContextService {
    private _designKey: string = null;        
    private _modelAdapter: IModelAdapter = new DefaultModelAdapter();
    private _rootPart: UIPart = null;
    private _updateInProgress: boolean = false;
    private _actionExecuting: boolean = false;
    private _isDirty: boolean = false;
    private _invalidCharacterPattern: RegExp = /[\s\%\/\?\)\(\.\']/g;
    private _parts: Map<string, UIPart> = new Map<string, UIPart>();
    private _viewer: any = null;
    private _lastError: any = null;

    getNewModel() {
        return this.initializeViewer();
    }

    getRoot() {
        return this._rootPart;
    }

    getParts() {
        return Array.from(this._parts.values());
    }

    getPartByRefChain(refChain) {
        return this._parts.get(refChain);
    }

    getPartByUiProp(partType, propName, propValue) {
/*        let part = null;

        // Use breeze to filter down to just parts of the correct type
        let query = breeze.EntityQuery
            .from('UIParts')
            .toType('UIPart')
            .where('PartType', '==', partType);
        let partsOfType = this._manager.executeQueryLocally(query);

        // Now filter to just the parts that match the UiProp
        let matchingParts = partsOfType.filter(function (p) { return p[propName] === propValue; })

        if (matchingParts.length > 0) {
            part = matchingParts[0];
        }

        return part;
*/
        // TODO: Implement getPartByUiProp
        alert("todo");
        return null;
    }

    updateProperty(refChain, name, value) {
        let ctx = this;
        let promise = new Promise((resolve, reject) => {
            if (ctx._updateInProgress) {
                console.info('Unable to update property ' + name +
                    ' while another property is being updated');

                reject();
            }

            ctx._updateInProgress = true;      

            ctx._viewer.setPropertyValues({
                refChain: refChain,
                properties: [
                    {
                        name: name,
                        value: value
                    }
                ]
            }, onSuccess, onError);
            
            function onSuccess(modelData) {
                try {
                    ctx.updateModel(modelData);
                    ctx.setDirty(true);
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    ctx._updateInProgress = false;      
                }
            }

            function onError(error) {
                ctx._updateInProgress = false;      
                console.error('Error updating property');
                reject();
            }
        });

        return promise;
    }

    updateProperties(properties: any) {
        let ctx = this;
        let promise = new Promise((resolve, reject) => {
            if (ctx._updateInProgress) {
                console.info('Unable to update properties' +
                    ' while another property is being updated');

                reject();
            }

            ctx._updateInProgress = true;      

            ctx._viewer.setPropertyValues(properties, onSuccess, onError);
            
            function onSuccess(modelData) {
                try {
                    ctx.updateModel(modelData);
                    ctx.setDirty(true);
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    ctx._updateInProgress = false;      
                }
            }

            function onError(error) {
                ctx._updateInProgress = false;      
                console.error('Error updating properties');
                reject();
            }
        });

        return promise;
    }

    resetProperty(refChain, name) {
        return this.updateProperty(refChain, name, null);
    }

    executeAction(actionParams) {
        let ctx = this;

        console.info('Executing action ' + actionParams.name);        
        
        let promise = new Promise((resolve, reject) => {
            if (ctx._actionExecuting) {
                console.info('Unable to execute action ' + actionParams.name +
                    ' while another action is in progress');

                reject();
            }

            ctx._actionExecuting = true;
            
            if (actionParams.params) {
                ctx._viewer.setPropertyValues({ uiActionParams: JSON.stringify(actionParams.params) }, function () {
                    doExecute()
                });
            }
            else {
                doExecute();
            }

            function doExecute() {
                ctx._viewer.executeAction(actionParams, onSuccess, onError)
            }

            function onSuccess(actionResult) {
                ctx._actionExecuting = false;
                
                if (actionResult.url) {
                    // Download output
                    var iframe = document.createElement("<iframe src='" + actionResult.url + "' style='display: none;' ></iframe>");
                    document.getElementById("body").insertAdjacentElement("beforeend", iframe);

                    setTimeout(function() {
                        iframe.remove();    
                    }, 1000);                       
                    
                    resolve();
                }
                else if (actionResult.title && actionResult.message) {
                    let message = null;

                    try {
                        message = JSON.parse(actionResult.message);
                    } catch (e) {
                        message = actionResult.message;
                    }

                    resolve(message);
                }
                else {
                    ctx.updateModel(actionResult);
                    ctx.setDirty(true);
                    resolve();
                }
            }

            function onError(error) {
                ctx._actionExecuting = false;
                console.error('Error occurred while executing action ' + actionParams.name);
                reject(error);
            }            
        })

        return promise;
    }

    endSession() {
        this.clearModel();
    }

    isDirty() {
        return this._isDirty;
    }

    isModelLoaded() {
        return (this._rootPart !== null);
    }

    setDesignKey(designKey: string) {
        this._designKey = designKey;
    }

    setModelAdapter(modelAdapter: IModelAdapter) {
        this._modelAdapter = modelAdapter;
    }

    getViewer() {
        return this._viewer;
    }

    getLastError() {
        return this._lastError;
    }

    private initializeViewer(modelBlob?) {
        if (!this._designKey) {
            throw "Must set C360 design key";
        }

        this.clearModel();

        let viewerElement = document.getElementById(Constants.ViewerDivId);
        if (!viewerElement) {
            viewerElement = document.createElement("div");
            viewerElement.setAttribute("id", Constants.ViewerDivId);
            
            document.body.insertAdjacentElement("afterbegin", viewerElement);
        }
        viewerElement.style.position = "absolute";
        viewerElement.style.zIndex = "-1";

        let promise = new Promise((resolve, reject) => {
            let viewerLoaded = (viewer) => {
                this._viewer = viewer;
                this._viewer.getPropertyValues(null, (modelData) => {
                    this.updateModel(modelData);
                    resolve(this._rootPart);
                });
            };

            let failedToLoad = (viewer) => {
                this._viewer = viewer;
                reject(viewer.state);
            }

            let viewerOptions = {
                container: viewerElement,
                design: this._designKey,
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
                    this._lastError = result.reason;
                    reject(result.reason);
                }
            });
        });

        return promise;
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

                    this._parts.delete(partToRemove.RefChain);
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

        if (this._parts.get(part.refChain)) {
            mergedPart = this._parts.get(part.refChain);
        } else {
            mergedPart = new UIPart();
            mergedPart.RefChain = part.refChain;
            this._parts.set(mergedPart.RefChain, mergedPart);
        }

        mergedPart.Name = part.Name;
        mergedPart.PartType = part.PartType;

        if (parentRefChain && this._parts.get(parentRefChain)) {
            mergedPart.Parent = this._parts.get(parentRefChain);
        }

        if (!mergedPart.UIProperties || isCompleteChangedPart) {
            mergedPart.UIProperties = [];
        }

        if (part.properties) {
            part.properties.forEach(function (prop) {
                // TODO - Optimize this so that the first time a part is added its properties aren't searched
                if (!isCompleteChangedPart) {
                    for (var i = 0, len = mergedPart.UIProperties.length; i < len; i++) {
                        if (mergedPart.UIProperties[i].FullName === prop.value.FullName) {
                            mergedPart.UIProperties.splice(i, 1);
                            break;
                        }
                    }
                }

                var tfm = transformProp(prop);
                mergedPart.UIProperties.push(tfm);
            });
        }

        mergedPart.Messages = (part.Messages) ? part.Messages : [];
        mergedPart.Actions = (part.Actions) ? part.Actions : [];

        function transformProp(prop) {         
            let transformed = prop.value;

            try {
                let toolTipObject = JSON.parse(transformed.Tooltip);

                transformed.Tooltip = toolTipObject.ToolTip;
                transformed.DataType = toolTipObject.DataType;
                transformed.CustomData = toolTipObject.CustomData;
            } catch (e) {
                transformed.DataType = getDataTypeFromValue(transformed);
            }

            function getDataTypeFromValue(prop) {
                // TODO: Look at value to determine prop type
                return 'String';
            }

            Object.defineProperty(transformed, 'BoundValue', {
                get: function () {
                    return transformed.Value;
                },
                set: function (newValue) {
                    transformed.Value = newValue;
                    ctx.updateProperty(part.refChain, prop.name, newValue)
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(transformed, 'inputType', {
                enumerable: true,
                configurable: false,
                get: function () {
                    if (transformed.DataType === 'Date') {
                        return 'date';
                    }
                    else if (transformed.DataType === 'Boolean') {
                        return 'checkbox';
                    }
                    else if (transformed.DataType === 'Integer' || transformed.DataType === 'Number') {
                        return 'number';
                    }
                    else {
                        return 'text';
                    }
                }
            });

            Object.defineProperty(transformed, 'isCheckbox', {
                enumerable: true,
                configurable: false,
                get: function () {
                    return (transformed.DataType === 'Boolean');
                }
            });

            Object.defineProperty(transformed, 'hasChoiceList', {
                enumerable: true,
                configurable: false,
                get: function () {
                    return (transformed.ChoiceList != null);
                }
            });

            Object.defineProperty(transformed, 'updateOn', {
                enumerable: true,
                configurable: false,
                get: function () {
                    if (transformed.isCheckbox || transformed.hasChoiceList) {
                        return 'default';
                    }
                    else
                        return 'blur';
                }
            });

            return transformed;
        }

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
        parts.forEach((part) => this._modelAdapter.visitPart(part));
    }
    
    private processPart(part) {
        let ctx = this;

        if (part.RefChain === 'Root') {
            ctx._rootPart = part;
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
            var valuePropName = uiProp.FullName.replace(ctx._invalidCharacterPattern, ctx._modelAdapter.invalidCharacterReplacement);
            var prop = uiProp;

            // Add property that points to UI Property
            Object.defineProperty(part, valuePropName, {
                get: function () {
                    return prop.BoundValue;
                },
                set: function (newValue) {
                    prop.BoundValue = newValue;
                },
                enumerable: true,
                configurable: true
            });

            // Add reset function
            prop.reset = function () {
                ctx.resetProperty(part.RefChain, prop.UiRuleName);
            };
            
            // Transform ChoicList data if it exists
            if (prop.ChoiceList) {
                prop.ChoiceList.forEach((choice) => {
                    // TODO: Parse out the value and text if choice list contains structured data
                    if (choice.DisplayString) {
                        choice.value = choice.DisplayString;
                        choice.text = choice.DisplayString;
                        delete choice.DisplayString;
                    }
                })
            }

            var propPropName = valuePropName + propSuffix;
            part[propPropName] = uiProp;
        });

        // Add properties as shortcuts to each child
        part.Children.forEach((uiChild) => {
            var childName = uiChild.Name.replace(ctx._invalidCharacterPattern, ctx._modelAdapter.invalidCharacterReplacement);
            var child = uiChild;

            Object.defineProperty(part, childName, {
                get: function () {
                    return child;
                },
                enumerable: true,
                configurable: true
            });
        });

        // Add shortcut to collection's children if applicable
        if (ctx._modelAdapter.isPartCollection(part)) {
            var collectionName = ctx._modelAdapter.parseCollectionName(part.Name);

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
                    var actionData = {
                        refChain: part.RefChain,
                        name: action.Name,
                        params: params
                    };

                    return ctx.executeAction(actionData);
                };
            });
        }
    }

    private clearModel() {
        this._rootPart = null;
        this._parts.clear();
        this.clearLastError();
        this.setDirty(false);

        if (this._viewer) {
            this._viewer.unload();
            this._viewer = null;
        }
    }

    private setDirty(dirty: boolean) {
        this._isDirty = dirty;
    }

    private onSessionEnded() {
        this.onModelClosed();
    }

    private onModelClosed() {
        this.clearModel();
    }

    private clearLastError() {
        this._lastError = null;
    }
  }
