import { UIAction } from './UIAction';
import { UIMessage } from './UIMessage';
import { UIProperty } from './UIProperty';
 
export class UIPart {
    RefChain: string;
    Name: string;
    PartType: string;
    UIProperties: Array<UIProperty>;
    Actions: Array<UIAction>;
    Messages: Array<UIMessage>;
    Parent: UIPart;
    Children: Array<UIPart>;

    // TODO: Implement allMessages property
/*    Object.defineProperty(entity, 'allMessages', {
        enumerable: true,
        configurable: false,
        get: function () {
            return entity.Messages.concat(_.flatten(_.pluck(entity.Children, 'allMessages')));
        }
    });    
*/}