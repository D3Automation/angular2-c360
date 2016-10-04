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

    hasChild(refChain: string): boolean {
        return this.children.some(child => child.refChain === refChain);
    }

    findChild(refChain: string): UIPart {
        return this.children.find(child => child.refChain === refChain);
    }

    removeChild(refChain: string) {
        let index = this.children.findIndex(child => child.refChain === refChain);
        if (index >= 0) {
            this.children.splice(index, 1);
        }
    }

    removeUIProperty(propName: string) {
        let index = this.uiProperties.findIndex(prop => prop.fullName === propName);
        if (index >= 0) {
            this.uiProperties.splice(index, 1);
        }
    }    
}