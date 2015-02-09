/*!
 * Cytoscape Support Images Plugin
 *
 * AUTHOR: Jhonatan da Rosa
 */
;(function(){ 'use strict';
  
  // Rectangle class
  function Rectangle(props) {
    if (props === undefined && this instanceof Rectangle) {
      return new Rectangle({
        x     : this.x,
        y     : this.y,
        width : this.width,
        height: this.height,
      });
    }
    // Allow instantiation without the 'new' keyword
    if (!(this instanceof Rectangle)) {
      return new Rectangle(props);
    }

    // Put explicitly provided properties onto the object
    if (props) {
      cytoscape.util.extend(this, props);
    }

    this.x = this.x || 0;
    this.y = this.y || 0;
  }

  Rectangle.prototype.containsPoint = function(x, y) {
    return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
  };
  
  Rectangle.prototype.set = function(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
  };

  Rectangle.prototype.equals = function(rect) {
    return this.x == rect.x && this.y == rect.y && this.width == rect.width && this.height == rect.height;
  };

  // Support Image class
  function SupportImage(props) {
    if (props === undefined && this instanceof SupportImage) {
      // called object.constructor();
      return new SupportImage(this.json());
    }
    function guid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
          return v.toString(16);
      });
    }

    // Allow instantiation without the 'new' keyword
    if (!(this instanceof SupportImage)) {
      return new SupportImage(props);
    }
    if (typeof props === 'string') {
      props = {url: props};
    }

    // Put explicitly provided properties onto the object
    if (props) {
      cytoscape.util.extend(this, props);
    }

    // Check if the image has url
    if (!this.url) {
      cytoscape.util.error('An Support Image must have a url set');
    }
    
    this._private = this._private || {};

    // create default variables
    if (this.bounds) {
      if (!(this.bounds instanceof Rectangle)) {
        this.bounds = new Rectangle(this.bounds);
      }
    } else {
      this.bounds = new Rectangle();
    }

    this.locked = this.locked === undefined ? false : this.locked;
    this.visible = this.visible === undefined ? true : this.visible;
    this.name = this.name || this.url;

    this.id = this.id || guid();
  }
  
  SupportImage.prototype.selected = function(param) {
    if (param !== undefined) {
      this._private.selected = param;
    } else {
      return this._private.selected;
    }
  };
  
  SupportImage.prototype.dragging = function(param) {
    if (param !== undefined) {
      this._private.dragging = param;
    } else {
      return this._private.dragging;
    }
  };

  SupportImage.prototype.json = function() {
    return {
      id     : this.id,
      url    : this.url,
      name   : this.name,
      locked : this.locked,
      visible: this.visible,
      bounds : {
        x     : this.bounds.x,
        y     : this.bounds.y,
        width : this.bounds.width,
        height: this.bounds.height,

      }
    };
  };

  function SupportImageCanvasRenderer(options) {
    this.options = options;
    
    this.data = {
      cy: options.cy,
      supportImageExt: options.supportImageExt,
      container: options.cy.container()
    };
    
    this.bindings = [];
    
    this.data.canvasContainer = document.createElement('div');
    this.data.canvasContainer.id = 'support-image-extension-div';
      
    var containerStyle = this.data.canvasContainer.style;
    containerStyle.position = 'absolute';
    containerStyle.zIndex = '0';
    containerStyle.overflow = 'hidden';

    // insert as first element in the container
    var container = this.data.container;
    container.insertBefore(this.data.canvasContainer, container.childNodes[0]);
    
    this.data.canvas = document.createElement('canvas');
    this.data.context = this.data.canvas.getContext('2d');
    this.data.canvas.style.position = 'absolute';
    this.data.canvas.setAttribute('data-id', 'layer-support-image-extension');
    this.data.canvas.style.zIndex = '0';
    this.data.canvasContainer.appendChild(this.data.canvas);

    this.load();
  }
  

  // RENDERER
  SupportImageCanvasRenderer.prototype.notify = function(params) {
    //console.log(params);
    switch( params.type ) {

      case 'destroy':
        this.destroy();
        return;

    }

    if (params.type === 'load' || params.type === 'resize') {
      this.invalidateContainerClientCoordsCache();
      this.matchCanvasSize(this.data.container);
    }

    this.redraw();
  };

  SupportImageCanvasRenderer.prototype.destroy = function() {
    this.destroyed = true;

    for (var i = 0; i < this.bindings.length; i++) {
      var binding = this.bindings[i];
      var b = binding;

      b.target.removeEventListener(b.event, b.handler, b.useCapture);
    }
  };

  SupportImageCanvasRenderer.prototype.registerBinding = function(target, event, handler, useCapture) {
    this.bindings.push({
      target : target,
      event : event,
      handler : handler,
      useCapture : useCapture
    });

    target.addEventListener(event, handler, useCapture);
  };
  
  SupportImageCanvasRenderer.prototype.load = function() {
    //console.log('load');
  };

  SupportImageCanvasRenderer.prototype.projectIntoViewport = function(clientX, clientY) {
    var offsets = this.findContainerClientCoords();
    var offsetLeft = offsets[0];
    var offsetTop = offsets[1];

    var x = clientX - offsetLeft;
    var y = clientY - offsetTop;

    x -= this.data.cy.pan().x;
    y -= this.data.cy.pan().y;
    x /= this.data.cy.zoom();
    y /= this.data.cy.zoom();
    return [x, y];
  };

  SupportImageCanvasRenderer.prototype.findContainerClientCoords = function() {
    var container = this.data.container;

    var bb = this.containerBB = this.containerBB || container.getBoundingClientRect();

    return [bb.left, bb.top, bb.right - bb.left, bb.bottom - bb.top];
  };

  SupportImageCanvasRenderer.prototype.invalidateContainerClientCoordsCache = function() {
    this.containerBB = null;
  };

  var isFirefox = typeof InstallTrigger !== 'undefined';

  SupportImageCanvasRenderer.prototype.getPixelRatio = function(){ 
    var context = this.data.context;

    var backingStore = context.backingStorePixelRatio ||
    context.webkitBackingStorePixelRatio ||
    context.mozBackingStorePixelRatio ||
    context.msBackingStorePixelRatio ||
    context.oBackingStorePixelRatio ||
      context.backingStorePixelRatio || 1;

        if( isFirefox ){ // because ff can't scale canvas properly
      return 1;
    }

    return (window.devicePixelRatio || 1) / backingStore;
  };

  // Resize canvas
  SupportImageCanvasRenderer.prototype.matchCanvasSize = function(container) {
    var data = this.data;
    var width = container.clientWidth;
    var height = container.clientHeight;
    var pixelRatio = this.getPixelRatio();
    var canvasWidth = width * pixelRatio;
    var canvasHeight = height * pixelRatio;
    var canvas;

    if (canvasWidth === this.canvasWidth && canvasHeight === this.canvasHeight) {
      return;
      // save cycles if same
    }

    // resizing resets the style

    var canvasContainer = data.canvasContainer;
    canvasContainer.style.width = width + 'px';
    canvasContainer.style.height = height + 'px';

    var canvas = data.canvas;

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

  };
  
  
  SupportImageCanvasRenderer.prototype.getCachedImage = function(url, onLoad) {
    var r = this;
    var imageCache = r.imageCache = r.imageCache || {};

    if (imageCache[url] && imageCache[url].image) {
      return imageCache[url].image;
    }

    var cache = imageCache[url] = imageCache[url] || {};

    var image = cache.image = new Image();
    image.addEventListener('load', onLoad);
    image.src = url;

    return image;
  }; 


  SupportImageCanvasRenderer.prototype.redraw = function(options) {
    options = options || {};

    var forcedZoom = options.forcedZoom;
    var forcedPan = options.forcedPan;
    var r = this;
    var pixelRatio = options.forcedPxRatio === undefined ? this.getPixelRatio() : options.forcedPxRatio;
    var cy = r.data.cy;
    var supportImageExt = r.data.supportImageExt;

    var zoom = cy.zoom();
    var effectiveZoom = forcedZoom !== undefined ? forcedZoom : zoom;
    var pan = cy.pan();
    var effectivePan = {
      x : pan.x,
      y : pan.y
    };

    if (forcedPan) {
      effectivePan = forcedPan;
    }

    // apply pixel ratio

    effectiveZoom *= pixelRatio;
    effectivePan.x *= pixelRatio;
    effectivePan.y *= pixelRatio;
    
    
    function setContextTransform(context, clear) {
      context.setTransform(1, 0, 0, 1, 0, 0);

      if ((clear === undefined || clear)) {
        context.clearRect(0, 0, r.canvasWidth, r.canvasHeight);
      }
      
      context.translate(effectivePan.x, effectivePan.y);
            context.scale(effectiveZoom, effectiveZoom);

      if (forcedPan) {
        context.translate(forcedPan.x, forcedPan.y);
      }
      if (forcedZoom) {
        context.scale(forcedZoom, forcedZoom);
      }
    }

    
    var supportImages = supportImageExt.images() || [];

    var context = this.data.context;
    setContextTransform(context);
    
    for (var idx = supportImages.length - 1; idx >= 0; --idx) {
        var image = supportImages[idx];
        if (image.visible) {
          this.drawSupportImage(context, image);
        }
    }
    
  };

  SupportImageCanvasRenderer.prototype.drawResizeControls = function(context, supportImage) {
    var supportImageExt = this.data.supportImageExt;
    
    context.beginPath();
    var resizeControls = supportImageExt.resizeControls();
    for (var i = 0; i < resizeControls.length; i++) {
      var control = resizeControls[i];
      context.rect(control.x, control.y, control.width, control.height);
    }

    context.fillStyle = 'lightgray';
    context.fill();
    context.stroke();
  };
  
  SupportImageCanvasRenderer.prototype.drawSupportImage = function(context, supportImage) {
    var r = this;
    
    // get image, and if not loaded then ask to redraw when later loaded
    var img = this.getCachedImage(supportImage.url, function(evt) {
      var resource = evt.currentTarget;
      var w = resource.width;
      var h = resource.height;
      supportImage.resourceW = w;
      supportImage.resourceH = h;
      supportImage.bounds.width = supportImage.bounds.width || w;
      supportImage.bounds.height = supportImage.bounds.height || h;
      r.redraw();
    });

    if (img.complete) {
      if (!supportImage.bounds.width) {
        supportImage.bounds.width = img.width;
      }
      if (!supportImage.bounds.height) {
        supportImage.bounds.height = img.height;
      }
      var x = supportImage.bounds.x;
      var y = supportImage.bounds.y;
      var w = supportImage.bounds.width;
      var h = supportImage.bounds.height;
      context.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
      
      if (supportImage.selected()) {
        context.beginPath();
        context.rect(x, y, w, h);
        context.stroke();
        
        this.drawResizeControls(context, supportImage);
      }
    }

  };


  // Extension core
  var SupportImageExtension = (function(){

    // helper function
    function bindEvent(supportImageExt, eventName, handler) {
      var cy = supportImageExt._private.cy;
      
      cy.on(eventName, function(evt) {
        evt.supportImageExt = supportImageExt;
        if (!(evt.cyTarget instanceof cytoscape.Core)) {
          return handler(evt);
        }
        
        var supportImages = supportImageExt.images();
        var resizeControls = supportImageExt.resizeControls();
        var pos = evt.cyPosition;

        // TODO: refactoring to make this check only when an image is selected
        var idx, len;
        for (idx = 0, len = resizeControls.length; idx < len; ++idx) {
          var control = resizeControls[idx];
          if (control.containsPoint(pos.x, pos.y)) {
            return handler(evt, control);
          }
        }
        
        for (idx = 0, len = supportImages.length; idx < len; ++idx) {
          var image = supportImages[idx];
          if (image.locked || !image.visible) continue;
          if (image.bounds.containsPoint(pos.x, pos.y)) {
            return handler(evt, image);
          }
        }
        
        return handler(evt);
      });
    }

    function initRenderer(supportImageExt, options) {
      
      var cy = supportImageExt._private.cy;
      var container = cy.container();

      options = cytoscape.util.extend({ name : window && container ? 'canvas' : 'null' }, options);

      var RendererProto = SupportImageCanvasRenderer;
      if (RendererProto == null) {
        cytoscape.util.error('Can not initialise Support Image Extension: No such renderer `%s` found; did you include its JS file?', options.name);
        return;
      }
      
      supportImageExt._private.renderer = new RendererProto(cytoscape.util.extend({}, options, {
        supportImageExt: supportImageExt,
        cy : cy
      }));
      
      // auto resize
      var r = supportImageExt._private.renderer;
      r.registerBinding(window, 'resize', cytoscape.util.debounce( function(e) {
        r.invalidateContainerClientCoordsCache();
        r.matchCanvasSize(r.data.container);
        r.redraw();
      }, 100 ) );

    }

    function init(supportImageExt) {
      initRenderer.apply(null, [supportImageExt]);
      
      var cy = supportImageExt._private.cy;
      
      cy.on('load', function() {
        supportImageExt.notify({type: 'load'});
      });
      cy.on('pan', function() {
        supportImageExt.notify({type: 'pan'});
      });
      cy.on('zoom', function() {
        var img = supportImageExt.selectedImage();
        if (img) {
          updateResizeControls(supportImageExt, img);
        }
        supportImageExt.notify({type: 'zoom'});
      });
      
      registerMouseHandlers.apply(null, [supportImageExt]);
    }

    function registerMouseHandlers(supportImageExt) {
      
      function getMousePosition(evt) {
        //console.log(evt);
        return {
          x: evt.cyRenderedPosition.x,
          y: evt.cyRenderedPosition.y
        };
      }
      var evtState = {};
      
      function saveCytoscapeState(cy) {
        var cyState = {
          boxSelectionEnabled : cy.boxSelectionEnabled(),
          userPanningEnabled : cy.userPanningEnabled(),
        };
        evtState.cyState = cyState;
      }
      
      function restoreCytoscapeState(cy) {
        var cyState = evtState.cyState;
        cy.boxSelectionEnabled(cyState.boxSelectionEnabled);
        cy.userPanningEnabled(cyState.userPanningEnabled);
      }
      
      bindEvent(supportImageExt, 'mousedown', function(evt, item){
        var cy = evt.cy;
        evtState.mouseDown = true;
        evtState.mousePosition = getMousePosition(evt);
        saveCytoscapeState(cy);


        if (item) {
          evt.stopPropagation();

          cy.boxSelectionEnabled(false);
          cy.userPanningEnabled(false);
          
          if (item instanceof SupportImage) {
            evt.supportImageExt.clearSelection();
            evtState.resizeControl = null;
            if (evtState.image) {
              evtState.image.selected(false);
              evtState.image.dragging(false);
            }
            
            item.selected(true);
            cy.trigger('supportimage.selection', [item]);
            updateResizeControls(evt.supportImageExt, item);
            
            evtState.image = item;
            evtState.imgBounds = cytoscape.util.extend({}, item.bounds);
            evt.supportImageExt.notify({type:'selection'});
          } else if (item instanceof Rectangle){//resize control
            evtState.resizeControl = item;
          } else {
            cytoscape.util.error('Unknown object detected: ' + item);
          }
          return false;
        } else {
          evt.supportImageExt.clearSelection();
          evtState.resizeControl = null;
          if (evtState.image) {
            evtState.image.selected(false);
            evtState.image.dragging(false);
          }
        }
        
        // console.log('mouse down');
        // console.log(image);
      });
      
      bindEvent(supportImageExt, 'mouseup', function(evt, item) {
        var cy = evt.cy;
        evtState.mouseDown = false;
        evtState.mousePosition = getMousePosition(evt);
        
        restoreCytoscapeState(cy);
        
        // console.log('mouse up');
        // console.log(image);
        
        if (evtState.image) {
          evtState.image.dragging(false);
          if (evtState.imgBounds) {
            var b1 = evtState.imgBounds;
            var b2 = evtState.image.bounds;
            if (!b2.equals(b1)) {
              cy.trigger('cysupportimages.imagemoved',
                [
                  evtState.image,
                  b1,
                  b2
                ]
              );
            }
          }
        }
        if (evtState.resizeControl) {
          if (evtState.imgBounds) {
            var b1 = evtState.imgBounds;
            var img = supportImageExt.selectedImage();
            var b2 = img.bounds;
            if (!b2.equals(b1)) {
              cy.trigger('cysupportimages.imageresized',
                [
                  img,
                  b1,
                  b2
                ]
              );
            }
          }
        }
        evtState.image = null;
        evtState.resizeControl = null;
      });
      
      bindEvent(supportImageExt, 'mousemove', function(evt, item) {
        
        if (evtState.image) {
          evtState.image.dragging(true);
          
          var lastMousePos = evtState.mousePosition;
          var currMousePos = getMousePosition(evt);
          var r = evt.supportImageExt._private.renderer;
          
          var p1 = r.projectIntoViewport(lastMousePos.x, lastMousePos.y);
          var p2 = r.projectIntoViewport(currMousePos.x, currMousePos.y);
          
          evtState.image.bounds.x += p2[0] - p1[0];
          evtState.image.bounds.y += p2[1] - p1[1];
          updateResizeControls(evt.supportImageExt, evtState.image);
          evt.supportImageExt.notify({type:'position'});
          
        } else if (evtState.resizeControl) {
          var control = evtState.resizeControl;
          
          var lastMousePos = evtState.mousePosition;
          var currMousePos = getMousePosition(evt);
          var r = evt.supportImageExt._private.renderer;
          
          var p1 = r.projectIntoViewport(lastMousePos.x, lastMousePos.y);
          var p2 = r.projectIntoViewport(currMousePos.x, currMousePos.y);
          
          var selected = evt.supportImageExt.selectedImage();
          var bounds = selected.bounds;

          var keepAspectRatio = evt.originalEvent.ctrlKey;
          var keepAxis = evt.originalEvent.shiftKey;

          var factorX = selected.resourceW / selected.resourceH;
          var factorY = selected.resourceH / selected.resourceW;
          var dx = p2[0] - p1[0];
          var dy = p2[1] - p1[1];
          
          switch(control.id) {
            case 'tl':
              if (keepAspectRatio) {
                var d = dx > 0 ? Math.max(dx, dy) : dx < 0 ? Math.min(dx, dy) : dy;
                var fx = d == dx ? 1 : factorX;
                var fy = d == dy ? 1 : factorY;

                dx = d * fx;
                dy = d * fy;
              }
              bounds.x += dx;
              bounds.y += dy;
              bounds.width -= keepAxis ? dx*2 : dx;
              bounds.height -= keepAxis ? dy*2 : dy;
              break;
            case 'tm':
              bounds.y += dy;
              bounds.height -= keepAxis ? dy*2 : dy;
              if (keepAspectRatio) {
                dy = keepAxis ? dy*2 : dy;
                bounds.x += dy * factorX * 0.5;
                bounds.width -= dy * factorX;
              }
              break;
            case 'tr':
              if (keepAspectRatio) {
                var d = dx > 0 ? Math.max(dx, dy) : dx < 0 ? Math.min(dx, dy) : dy;
                var fx = d == dx ? 1 : -factorX;
                var fy = d == dy ? 1 : -factorY;

                dx = d * fx;
                dy = d * fy;
              }

              bounds.width += keepAspectRatio && keepAxis ? dx*2 : dx;
              bounds.y += dy;
              bounds.height -= keepAxis ? dy*2: dy;
              if (keepAxis) {
                bounds.x -= keepAspectRatio ? dx : dx * 0.5;
              }
              break;
            case 'bl':
              if (keepAspectRatio) {
                var d = dx > 0 ? Math.max(dx, dy) : dx < 0 ? Math.min(dx, dy) : dy;
                var fx = d == dx ? 1 : -factorX;
                var fy = d == dy ? 1 : -factorY;

                dx = d * fx;
                dy = d * fy;
              }
              bounds.x += dx;
              bounds.width -= keepAxis ? dx*2 : dx;
              bounds.height += keepAspectRatio && keepAxis ? dy*2 : dy;
              if (keepAxis) {
                bounds.y -= keepAspectRatio ? dy : dy * 0.5;
              }
              break;
            case 'bm':
              bounds.height += dy;
              if (keepAxis) {
                bounds.y -= dy;
                bounds.height += dy;
              }
              if (keepAspectRatio) {
                dy = keepAxis ? dy*2 : dy;
                bounds.x -= dy * factorX * 0.5;
                bounds.width += dy * factorX;
              }
              break;
            case 'br':
              if (keepAspectRatio) {
                var d = dx > 0 ? Math.max(dx, dy) : dx < 0 ? Math.min(dx, dy) : dy;
                var fx = d == dx ? 1 : factorX;
                var fy = d == dy ? 1 : factorY;

                dx = d * fx;
                dy = d * fy;
              }
              bounds.width += dx;
              bounds.height += dy;
              if (keepAxis) {
                bounds.x -= dx * 0.5;
                bounds.y -= dy * 0.5;
              }
              break;
            case 'ml':
              bounds.x += dx;
              bounds.width -= keepAxis ? dx*2 : dx;
              if (keepAspectRatio) {
                dx = keepAxis ? dx*2 : dx;
                bounds.y += dx * factorY * 0.5;
                bounds.height -= dx * factorY;
              }
              break;
            case 'mr':
              bounds.width += dx;
              if (keepAxis) {
                bounds.x -= dx;
                bounds.width += dx;
              }
              if (keepAspectRatio) {
                dx = keepAxis ? dx*2 : dx;
                bounds.y -= dx * factorY * 0.5;
                bounds.height += dx * factorY;
              }
              break;
          }
          if (bounds.width < 10) {
            bounds.width = 10;
          }
          if (bounds.height < 10) {
            bounds.height = 10;
          }
          
          updateResizeControls(evt.supportImageExt, selected);
          evt.supportImageExt.notify({type:'resize'});
        }
        evtState.mousePosition = getMousePosition(evt);
      });
    }

    function updateResizeControls(supportImageExt, supportImage) {
      var x = supportImage.bounds.x;
      var y = supportImage.bounds.y;
      var w = supportImage.bounds.width;
      var h = supportImage.bounds.height;

      var resizeControls = supportImageExt.resizeControls();
      var cw = 5 * 1/supportImageExt._private.cy.zoom();
      var ch = 5 * 1/supportImageExt._private.cy.zoom();
      if (cw < 5) {
        cw = 5;
      }
      if (ch < 5) {
        ch = 5;
      }
      // top-left
      resizeControls[0].set(x-cw/2, y-ch/2, cw, ch);
      // top-middle
      resizeControls[1].set(x+w/2-cw/2, y-ch/2, cw, ch);
      // top-right
      resizeControls[2].set(x+w-cw/2, y-ch/2, cw, ch);
      // bottom-left
      resizeControls[3].set(x-cw/2, y+h-ch/2, cw, ch);
      // bottom-middle
      resizeControls[4].set(x+w/2-cw/2, y+h-ch/2, cw, ch);
      // bottom-right
      resizeControls[5].set(x+w-cw/2, y+h-ch/2, cw, ch);
      // middle-left
      resizeControls[6].set(x-cw/2, y+h/2-ch/2, cw, ch);
      // middle-right
      resizeControls[7].set(x+w-cw/2, y+h/2-ch/2, cw, ch);
    }

    function SupportImageExtension(options) {
      // Allow instantiation without the 'new' keyword
      if (!(this instanceof SupportImageExtension)) {
        return new SupportImageExtension(props);
      }
      
      var RESIZE_CONTROLS = 8;
      
      var baseControl = {x:0, y: 0, width:5, height:5};
      this._private = {
        supportImages : [],
        resizeControls : [],
        cy: options.cy
      };
      
      var ids = ['tl','tm','tr','bl','bm','br','ml','mr'];
      for (var i = 0; i < RESIZE_CONTROLS; i++) {
        this.resizeControls().push(new Rectangle(cytoscape.util.extend(baseControl, {id:ids[i]})));
      }

      init.apply(null,[this]);
    }

    SupportImageExtension.prototype.load = function(json) {
      if (typeof json === 'string') {
        json = JSON.parse(json);
      }

      if (json.images) {
        var imgs = json.images;
        for (var i = 0; i < imgs.length; i++) {
          var img = new SupportImage(imgs[i]);
          this.images().push(img);
        }

        if (json.selected) {
          var img = this.image(json.selected);
          this.selectImage(img);
        }
      }
    };

    SupportImageExtension.prototype.render = function() {
      var img = this.selectedImage();
      if (img) {
        updateResizeControls(this, img);
      }
      this._private.renderer.notify({type: 'render'});
    }

    SupportImageExtension.prototype.resizeControls = function() {
      return this._private.resizeControls;
    };

    SupportImageExtension.prototype.images = function() {
      return this._private.supportImages;
    };

    SupportImageExtension.prototype.image = function(id) {
      var imgs = this.images();

      var idx, len;
      for (idx = 0, len = imgs.length; idx < len; ++idx) {
          var image = imgs[idx];
          if (image.id == id) return image;
      }
      return null;
    };
      
    SupportImageExtension.prototype.notify = function(params) {
      var r = this._private.renderer;
      
      r.notify(params);
    };

    SupportImageExtension.prototype.addSupportImage = function(img) {

      var supImg = new SupportImage(img);
      
      this.images().push(supImg);
      
      this._private.renderer.notify({type: 'add', supportImage: supImg});

      return supImg;
    };

    SupportImageExtension.prototype.removeSupportImage = function(img) {

      var imgs = this.images();

      var idx = imgs.indexOf(img);

      if (idx > -1) {
          imgs.splice(idx, 1);
      }

      this._private.renderer.notify({type: 'remove', supportImage: img});
    };

    SupportImageExtension.prototype.setImageLocked = function(img, locked) {

      img.locked = locked;

      img.selected(false);

      this._private.renderer.notify({type: 'changed', supportImage: img});
    };

    SupportImageExtension.prototype.setImageVisible = function(img, visible) {

      img.visible = visible;

      img.selected(false);

      this._private.renderer.notify({type: 'changed', supportImage: img});
    };

    SupportImageExtension.prototype.moveImageUp = function(img) {

      var imgs = this.images();
      for (var i = 1; i < imgs.length; i++) {
        var curr = imgs[i];
        if (curr.id == img.id) {
          imgs[i] = imgs[i-1];
          imgs[i-1] = curr;
          break;
        }
      }
      this._private.renderer.notify({type: 'changed', supportImage: img});
    };

    SupportImageExtension.prototype.moveImageDown = function(img) {

      var imgs = this.images();
      for (var i = 0; i < imgs.length - 1; i++) {
        var curr = imgs[i];
        if (curr.id == img.id) {
          imgs[i] = imgs[i+1];
          imgs[i+1] = curr;
          break;
        }
      }
      this._private.renderer.notify({type: 'changed', supportImage: img});
    };
    
    SupportImageExtension.prototype.selectedImage = function() {
      var imgs = this.images();

      var idx, len;
      for (idx = 0, len = imgs.length; idx < len; ++idx) {
          var image = imgs[idx];
          if (image.selected()) return image;
      }
      return null;
    };

    SupportImageExtension.prototype.selectImage = function(img) {
      if (img.locked || !img.visible) return;

      var imgs = this.images();

      var idx, len;
      for (idx = 0, len = imgs.length; idx < len; ++idx) {
          var image = imgs[idx];
          image.selected(false);
      }
      img.selected(true);
      updateResizeControls(this, img);
      this._private.renderer.notify({type: 'selection'});
    };
    
    SupportImageExtension.prototype.clearSelection = function() {

      var imgs = this.images();

      var idx, len;
      for (idx = 0, len = imgs.length; idx < len; ++idx) {
          imgs[idx].selected(false);
      }

      this._private.renderer.notify({type: 'selection'});
    };

    SupportImageExtension.prototype.json = function() {
      var imgs = [];
      var images = this.images();
      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        imgs.push(img.json());
      }
      var selected = this.selectedImage();
      var selectedId = selected ? selected.id : undefined;
      return {
        selected: selectedId,
        images: imgs
      };
    };

    return SupportImageExtension;
  })();

  // registers the extension on a cytoscape lib ref
  var register = function( cytoscape ){
    if( !cytoscape ){ return; } // can't register if cytoscape unspecified

    // if you want a core extension
    cytoscape('core', 'supportimages', function( options ){ // could use options object, but args are up to you
      var cy = this;

      if (cy._private.supportImageCore) {
        return cy._private.supportImageCore;
      } else {
        options = options || {};
        options.cy = options.cy || cy;
        cy._private.supportImageCore = new SupportImageExtension(options);
        return cy._private.supportImageCore;
      }

      return this; // chainability
    });

  };

  if( typeof module !== 'undefined' && module.exports ){ // expose as a commonjs module
    module.exports = register;
  }

  if( typeof define !== 'undefined' && define.amd ){ // expose as an amd/requirejs module
    define('cytoscape-supportimages', function(){
      return register;
    });
  }

  if( typeof cytoscape !== 'undefined' ){ // expose to global cytoscape (i.e. window.cytoscape)
    register( cytoscape );
  }

})();