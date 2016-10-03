import { UIAction } from './ui-action';
import { UIMessage } from './ui-message';
import { UIProperty } from './ui-property';

export class UIPart {
    refChain: string;
    name: string;
    partType: string;
    uiProperties: Array<UIProperty> = new Array<UIProperty>();
    actions: Array<UIAction> = new Array<UIAction>();
    messages: Array<UIMessage> = new Array<UIMessage>();
    parent: UIPart;
    children: Array<UIPart> = new Array<UIPart>();

    get allMessages(): Array<UIMessage> {
        return this.children.map(child => { return child.allMessages; }).reduce((prev, curr) =>
            prev.concat(curr), this.messages);
    }
}