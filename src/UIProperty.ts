import { C360ContextService } from './c360-context.service';
import { UIPart } from './UIPart';
import { ChoiceListItem } from './ChoiceListItem';

export class UIProperty {
    private choiceListData: Array<ChoiceListItem>;
    private toolTipValue: string;
    private dataTypeValue: string;
    private customDataValue: any;

    constructor(private c360Context: C360ContextService, private hostPart: UIPart, private adeskProp: any) {
        this.parseChoiceList();
        this.parseTooltip();
    }

    get category(): string {
        return this.adeskProp.Category
    }

    get choiceList(): Array<ChoiceListItem> {
        return this.choiceListData;
    }

    get choiceListDisplayMode(): number {
        return this.adeskProp.ChoiceListDisplayMode;
    }

    get customData(): any {
        return this.customDataValue;
    }

    get dataType(): string {
        return this.dataTypeValue;
    }

    get errorInfo(): any {
        return this.adeskProp.ErrorInfo;
    }

    get fullName(): string {
        return this.adeskProp.FullName;
    }

    get inputType(): string {
        if (this.dataType === 'Date') {
            return 'date';
        }
        else if (this.dataType === 'Boolean') {
            return 'checkbox';
        }
        else if (this.dataType === 'Integer' || this.dataType === 'Number') {
            return 'number';
        }
        else {
            return 'text';
        }
    }

    get invParamName(): string {
        return this.adeskProp.InvParamName;
    }

    get isCheckbox(): boolean {
        return (this.dataType === 'Boolean');
    }

    get isLocked(): boolean {
        return this.adeskProp.IsLocked;
    }

    get isModified(): boolean {
        return this.adeskProp.IsModified;
    }

    get isReadOnly(): boolean {
        return this.adeskProp.IsReadOnly;
    }

    get part(): UIPart {
        return this.hostPart;
    }

    get precision(): number {
        return this.adeskProp.Precision;
    }

    get restrictToList(): boolean {
        return this.adeskProp.RestrictToList;
    }

    get sequence(): number {
        return this.adeskProp.Sequence;
    }

    get tooltip(): string {
        return this.adeskProp.Tooltip;
    }

    get uiRuleName(): string {
        return this.adeskProp.UiRuleName;
    }

    get value(): any {
        return this.adeskProp.Value;
    }
    set value(newValue: any) {
        this.adeskProp.Value = newValue;
        this.c360Context.updateProperty(this.part.refChain, this.uiRuleName, newValue)
    }

    
    get hasChoiceList(): boolean {
        return this.choiceList && this.choiceList.length > 0; 
    }

    reset() {
        this.c360Context.resetProperty(this.part.refChain, this.uiRuleName);
    }

    private parseChoiceList(): void {
        if (this.adeskProp.ChoiceList) {
            this.choiceListData = this.adeskProp.ChoiceList.map(choice => {
                return <ChoiceListItem>{ value: choice.DisplayString, text: choice.DisplayString};
            });
        }
    }

    private parseTooltip() {
        try {
            let toolTipObject = JSON.parse(this.adeskProp.Tooltip);

            this.toolTipValue = toolTipObject.ToolTip;
            this.dataTypeValue = toolTipObject.DataType;
            this.customDataValue = toolTipObject.CustomData;
        } catch (e) {
            this.dataTypeValue = this.getDataTypeFromValue();
        }
    }

    private getDataTypeFromValue() {
        // TODO: Look at value to determine prop type
        return 'String';
    }    
}