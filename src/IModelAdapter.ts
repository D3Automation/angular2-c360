import {UIPart} from './UIPart';
 
export interface IModelAdapter {
        invalidCharacterReplacement: string;

        isPartCollection(part: UIPart): boolean;

        parseCollectionName(partName: string): string;

        visitPart(part: UIPart): void;    
}