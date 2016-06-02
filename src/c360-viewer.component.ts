import { Component, Input, ElementRef, OnInit, OnDestroy } from '@angular/core';

declare var jQuery: any;

@Component({
  selector: 'c360-viewer',
  template: '<div (window:resize)="onResize($event)"></div>',
  styles: [`
    position: absolute;
    z-index: -1;'
    `]
})
export class C360ViewerComponent implements OnInit {
    // TODO: Move div id to constant
    private _compElement;
    private _viewerElement;
    
    constructor(el: ElementRef) {
        this._compElement = jQuery(el.nativeElement);
    }
    
    ngOnInit() {
        this._viewerElement = jQuery('#c360Viewer');

        // Wait for any other dynamic position to settle down first, then position viewer
        setTimeout(() => {
            this.positionViewer();
        }, 100);
    }
    
    ngOnDestroy() {
        this._viewerElement.offset({ top: 0, left: 0 });
        // Use z-index rather than visibility to hide/show, since the viewer apparently
        //  doesn't updated itself when hidden
        this._viewerElement.css('z-index', '-1');
    }
    
    onResize(event) {
        this.positionViewer();
    }

    private positionViewer() {
        // Use z-index rather than visibility to hide/show, since the viewer apparently
        //  doesn't updated itself when hidden
        this._viewerElement.css('z-index', '1');

        this._viewerElement.offset(this._compElement.offset());

        var width = this._compElement.width();
        var widthPx = width + 'px';
        var height = this._compElement.height();
        var heightPx = height + 'px';

        this._viewerElement.css('width', widthPx);
        this._viewerElement.css('height', heightPx);

        // Just setting the css would do it, but since c360 sets the width and height
        //  attributes on iframe, we'll set them here to in order to prevent any confusion
        var iFrame = jQuery(this._viewerElement.children()[0]);
        iFrame.css('width', widthPx);
        iFrame.width(width);
        iFrame.css('height', heightPx);
        iFrame.height(height);
    }
}
