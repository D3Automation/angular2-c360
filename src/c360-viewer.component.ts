import { Component, Input, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { ViewerDivId } from './constants';

@Component({
  selector: 'c360-viewer',
  template: '<div (window:resize)="onResize($event)"></div>'})
export class C360ViewerComponent implements OnInit {
    private componentElement: HTMLElement;
    private viewerElement: HTMLElement;
    
    constructor(el: ElementRef) {
        this.componentElement = el.nativeElement;        
    }
    
    ngOnInit() {
        this.viewerElement = document.getElementById(ViewerDivId);

        // Wait for any other dynamic position to settle down first, then position viewer
        setTimeout(() => {
            this.positionViewer();
        }, 100);
    }
    
    ngOnDestroy() {
        this.viewerElement.style.top = "0";
        this.viewerElement.style.left = "0";
        // Use z-index rather than visibility to hide/show, since the viewer apparently
        //  doesn't updated itself when hidden
        this.viewerElement.style.zIndex = "-1";
    }
    
    onResize(event) {
        this.positionViewer();
    }

    private positionViewer() {
        let widthPx = this.componentElement.clientWidth + "px";
        let heightPx = this.componentElement.clientHeight + "px";

        // Use z-index rather than visibility to hide/show, since the viewer apparently
        //  doesn't updated itself when hidden
        this.viewerElement.style.zIndex = "1";
        this.viewerElement.style.top = this.componentElement.offsetTop + "px";
        this.viewerElement.style.left = this.componentElement.offsetLeft + "px";
        this.viewerElement.style.width = widthPx;
        this.viewerElement.style.height = heightPx;

        let iFrame = <HTMLElement>this.viewerElement.firstElementChild;
        iFrame.style.width = widthPx;
        iFrame.style.height = heightPx;
    }
}
