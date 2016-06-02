import { Injectable } from '@angular/core';

declare var breeze: any;
declare var _: any;

@Injectable()
export class C360Model {
    initialize(metadataStore) {
        var DT = breeze.DataType; // alias

        metadataStore.addEntityType({
            shortName: 'UIPart',
            namespace: 'Eto',
            dataProperties: {
                RefChain: {dataType: DT.String, isPartOfKey: true},
                Name: {dataType: DT.String},
                PartType: {dataType: DT.String},
                ParentRefChain: { dataType: DT.String }
            },
            navigationProperties: {
                Parent: {
                    entityTypeName: 'UIPart:#Eto', isScalar: true,
                    associationName: 'UIPart_UIPart', foreignKeyNames: ['ParentRefChain']
                },
                Children: {
                    entityTypeName: 'UIPart:#Eto', isScalar: false,
                    associationName: 'UIPart_UIPart'
                }
            }
        });

        function uiPartInit(entity) {
            Object.defineProperty(entity, 'allMessages', {
                enumerable: true,
                configurable: false,
                get: function () {
                    return entity.Messages.concat(_.flatten(_.pluck(entity.Children, 'allMessages')));
                }
            });
        }

        metadataStore.registerEntityTypeCtor('UIPart', null, uiPartInit);
    }    
}
