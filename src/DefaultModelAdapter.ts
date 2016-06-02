import {UIPart} from './ui-part';
 
export class DefaultModelAdapter {
        invalidCharacterReplacement: string = '';

        isPartCollection(part: UIPart) {
            return part.Name.endsWith('Collection');
        }

        parseCollectionName(partName: string) {
            var single = partName.replace('Collection', '');
            var plural = null;

            if (single.endsWith('y')) {
                plural = single.substring(0, single.length - 1) + 'ies';
            } else {
                plural = single + 's';
            }

            return plural;
        }

        visitPart(part: UIPart) { }    
}