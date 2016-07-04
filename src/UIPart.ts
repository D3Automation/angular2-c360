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

    get AllMessages(): Array<UIMessage> {
        return this.Children.map(child => { return child.AllMessages; }).reduce((prev, curr) =>
            prev.concat(curr), this.Messages);
    }
}