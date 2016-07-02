import { Injectable, OnInit } from '@angular/core';
import { C360Model } from './C360Model';
import { UIPart } from './ui-part';
import { DefaultModelAdapter } from './DefaultModelAdapter';

declare var breeze: any;
declare var ADSK: any;

@Injectable()
export class C360ContextService {
    private _c360Model: C360Model;
    constructor() {
        this._c360Model = new C360Model(this._manager.metadataStore);
    }
    
    // TODO: Require setting designKey at startup
    private _designKey: string = '575458448649916390/2gn1dj1tslb4';        
    // TODO: Allow setting model adapter at startup
    private _modelAdapter = new DefaultModelAdapter();
    private _rootPart = null;
    private _updateInProgress = false;
    private _actionExecuting = false;
    private _isDirty = false;
    private _invalidCharacterPattern = /[\s\%\/\?\)\(\.\']/g;
    private _manager = new breeze.EntityManager();
    private _viewer = null;
    // TODO: Store viewer div id in constant
    private _viewerDivId = 'c360Viewer';

    getNewModel() {
        return this.initializeViewer();
    }

    getRoot() {
        return this._rootPart;
    }

    getParts() {
        return this._manager.getEntities('UIPart');
    }

    getPartByRefChain(refChain) {
        return this._manager.getEntityByKey('UIPart', refChain);
    }

    getPartByUiProp(partType, propName, propValue) {
        let part = null;

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

    setModelAdapter(adapter) {
/*        if (adapter.invalidCharacterReplacement && angular.isString(adapter.invalidCharacterReplacement)) {
            this._modelAdapter.invalidCharacterReplacement = adapter.invalidCharacterReplacement;
        }

        if (adapter.visitPart && angular.isFunction(adapter.visitPart)) {
            this._modelAdapter.visitPart = adapter.visitPart;
        }

        if (adapter.isPartCollection && angular.isFunction(adapter.isPartCollection)) {
            this._modelAdapter.isPartCollection = adapter.isPartCollection;
        }

        if (adapter.parseCollectionName && angular.isFunction(adapter.parseCollectionName)) {
            this._modelAdapter.parseCollectionName = adapter.parseCollectionName;
        }
*/    }

    getViewer() {
        return this._viewer;
    }

    private initializeViewer(modelBlob?) {
        this.clearModel();

        let viewerElement = document.getElementById(this._viewerDivId);
        if (!viewerElement) {
            viewerElement = document.createElement("div");
            viewerElement.setAttribute("id", this._viewerDivId);
            
            document.body.insertAdjacentElement("afterbegin", viewerElement);
        }

        let promise = new Promise((resolve, reject) => {
            let viewerLoaded = (viewer) => {
                this._viewer = viewer;
                this._viewer.getPropertyValues(null, (modelData) => {
                    this.updateModel(modelData);
                    resolve(this._rootPart);
                });
            };

            let failedToLoad = (result) => {
                reject(result);
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
                    reject(result.reason);
                }
            });
        });

        return promise;
    }

    private updateModel(modelData) {
        // Updated the entity manager with new/updated entities
        this.mergePart(modelData, modelData.parentRefChain);

        // Detach deleted entities
        if (modelData.removedRefChains) {
            modelData.removedRefChains.forEach((refChain) => {
                let partToRemove = this.getPartByRefChain(refChain);
                if (partToRemove) {
                    if (partToRemove.Parent && partToRemove.Parent.hasOwnProperty(partToRemove.Name)) {
                        delete partToRemove.Parent[partToRemove.Name];
                    }

                    this._manager.detachEntity(partToRemove);
                }
            })
        }

        // Post-process parts (add shortcut properties, action methods, etc.)
        this.processParts(this._manager.getEntities('UIPart'))
    }

    private mergePart(part: any, parentRefChain?: string) {
        let ctx = this;        
        let childEntities = [];
        let isCompleteChangedPart = (part.isCompleteChangedPart == true);
        let mergedEntity;
        let initialValues = {
            RefChain: part.refChain,
            Name: part.Name,
            PartType: part.PartType,
            ParentRefChain: parentRefChain
        };

        try {
            mergedEntity = ctx._manager.createEntity('UIPart', initialValues, breeze.EntityState.Unchanged,
                breeze.MergeStrategy.OverwriteChanges);
        } catch (error) {
            console.log(error);            
        }

        if (!mergedEntity.UIProperties || isCompleteChangedPart) {
            mergedEntity.UIProperties = [];
        }

        if (part.properties) {
            part.properties.forEach(function (prop) {
                // TODO - Optimize this so that the first time a part is added its properties aren't searched
                if (!isCompleteChangedPart) {
                    for (var i = 0, len = mergedEntity.UIProperties.length; i < len; i++) {
                        if (mergedEntity.UIProperties[i].FullName === prop.value.FullName) {
                            mergedEntity.UIProperties.splice(i, 1);
                            break;
                        }
                    }
                }

                mergedEntity.UIProperties.push(transformProp(prop));
            });
        }

        mergedEntity.Messages = (part.Messages) ? part.Messages : [];
        mergedEntity.Actions = (part.Actions) ? part.Actions : [];

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

        if (part.children) {
            part.children.forEach((child) => {
                ctx.mergePart(child, part.refChain);
            });
        }
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
        this._manager.clear();
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
  }
