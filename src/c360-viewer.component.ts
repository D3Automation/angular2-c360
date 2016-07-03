import { Component, Input, ElementRef, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'c360-viewer',
  template: '<div (window:resize)="onResize($event)"></div>'})
export class C360ViewerComponent implements OnInit {
    // TODO: Move div id to constant
    private _compElement: HTMLElement;
    private _viewerElement: HTMLElement;
    
    constructor(el: ElementRef) {
        this._compElement = el.nativeElement;
    }
    
    ngOnInit() {
        this._viewerElement = document.getElementById('c360Viewer');

        // Wait for any other dynamic position to settle down first, then position viewer
        setTimeout(() => {
            this.positionViewer();
        }, 100);
    }
    
    ngOnDestroy() {
        this._viewerElement.style.top = "0";
        this._viewerElement.style.left = "0";
        // Use z-index rather than visibility to hide/show, since the viewer apparently
        //  doesn't updated itself when hidden
        this._viewerElement.style.zIndex = "-1";
    }
    
    onResize(event) {
        this.positionViewer();
    }

    private positionViewer() {
        let widthPx = this._compElement.clientWidth + "px";
        let heightPx = this._compElement.clientHeight + "px";

        // Use z-index rather than visibility to hide/show, since the viewer apparently
        //  doesn't updated itself when hidden
        this._viewerElement.style.zIndex = "1";
        this._viewerElement.style.top = this._compElement.offsetTop + "px";
        this._viewerElement.style.left = this._compElement.offsetLeft + "px";
        this._viewerElement.style.width = widthPx;
        this._viewerElement.style.height = heightPx;

        let iFrame = <HTMLElement>this._viewerElement.firstElementChild;
        iFrame.style.width = widthPx;
        iFrame.style.height = heightPx;
    }
}
