// @ts-nocheck
/* JS9 viewer plugin support extracted from viewer.js. */

"use strict";

function JS9InstallViewerPlugins(JS9){
    // ---------------------------------------------------------------------
    // plugin support
    // ---------------------------------------------------------------------
    
    const toCollection = function(value){
    	return JS9.wrapCollection(value);
    };

    // add a plugin definition. Plugins will initialized after document is loaded
    JS9.RegisterPlugin = function(xclass, xname, func, opts){
        let name, m, type, url, title;
        const heading = xclass;
        // sanity check
        if( !xclass || !xname || !func ){ return; }
        // first and last name of plugin
        name = xclass + xname;
        // massage the opts a bit
        if( opts ){
    	if( opts.viewMenuItem ){
    	    opts.menuItem = opts.viewMenuItem;
    	}
    	// default is view menu
    	if( opts.menuItem && !opts.menu ){
    	    opts.menu = "view";
    	}
    	if( opts.menu ){
    	    opts.menu = opts.menu.toLowerCase();
    	}
        } else {
    	opts = [];
        }
        // save the plugin root name as part of a regexp
        if( JS9.PLUGINS ){
    	JS9.PLUGINS += "|";
        }
        JS9.PLUGINS += name.replace(/JS9/, "");
        JS9.PLUGINS += "|";
        JS9.PLUGINS += xname;
        // save the plug-in
        JS9.plugins.push({xclass, xname, name, opts, func, instances: []});
        // save help, if necessary
        if( opts.help ){
    	m = opts.help.match(/^.*[\\/]/);
    	if( m[0] ){
    	    type = `plugins/${m[0].replace(/[\\/]+$/, "")}`;
    	}
    	url = opts.help.replace(/^.*[\\/]/, "");
    	if( opts.menuItem ){
    	    title = opts.menuItem;
    	} else {
    	    title = name;
    	}
    	JS9.helpOpts[xname] = {type, url, heading, title};
        }
        // if JS9 already is inited, we need to instantiate this plugin
        // this can happen when using Require.js, for example
        if( JS9.inited ){
    	JS9.instantiatePlugins();
        }
    };
    
    // create a new plugin instance, attached to the specified element
    JS9.instantiatePlugin = function(el, plugin, winhandle, args){
        let i, tplugin, instance, divid, divjq, pdivjq, html, ndiv, did;
        let visible = "visible";
        const resolveElement = (value) => {
    	    if( !value ){
    		return null;
    	    }
    	    if( JS9.isWrappedCollection(value) ){
    		return value[0];
    	    }
    	    if( typeof value === "string" ){
    		return value.charAt(0) === "#" ?
    		    document.querySelector(value) :
    		    document.getElementById(value);
    	    }
    	    return value;
        };
        // if plugin is a string, get plugin object by name
        if( typeof plugin === "string" ){
    	for(i=0; i<JS9.plugins.length; i++){
    	    tplugin = JS9.plugins[i];
    	    if( tplugin.name === plugin ){
    		plugin = tplugin;
    		break;
    	    }
    	}
    	// did we find it?
    	if( typeof plugin === "string" ){
    	    JS9.error(`unknown plugin: ${plugin}`);
    	}
        }
        // create an object inheriting the constructor prototype
        instance = Object.create(plugin.func.prototype);
        // save full name
        instance.name = plugin.name;
        // routine to tell if this instance active
        instance.isActive = function(cbname){
    	if( this.status !== "active" ){
    	    return false;
    	}
    	if( cbname && !{}.hasOwnProperty.call(this.plugin.opts, cbname) ){
    	    return false;
    	}
    	switch(this.winType){
    	case "virtual":
    	    return true;
    	default:
    	    return this.divjq.is(":visible");
    	}
        };
        // routine to log error
        instance.errLog = function(cbname, e){
    	JS9.log("error in %s: %s [%s]\n%s",
    		cbname, this.name, e.message, JS9.strace(e));
        };
        // save the div as a wrapped collection
        if( el ){
    	if( JS9.isWrappedCollection(el) ){
    	    divjq = el;
    	} else if( typeof el === "object" ){
    	    divjq = toCollection(resolveElement(el));
    	} else {
    	    divjq = toCollection(resolveElement(el));
    	}
    	// if we already have created this instance, we are done
    	for(i=0; i<plugin.instances.length; i++){
    	    if( divjq.is(plugin.instances[i].odivjq) ){
    		return plugin.instances[i];
    	    }
    	}
        } else {
    	divjq = toCollection(document.createElement("div"));
        }
        // save returned light id and type ("virtual", "light", "div")
        if( !el ){
    	// save id
    	instance.id = plugin.name;
    	// save type
    	instance.winType = "virtual";
        } else if( winhandle ){
    	// save id
    	instance.id = divjq.attr("id") || plugin.name;
    	// save type
    	instance.winType = "light";
    	instance.winHandle = winhandle;
    	// this is the original div
    	instance.odivjq = divjq;
    	// this is the div which the instance sees
    	instance.divjq = divjq;
    	// the light window is the the outer div
    	instance.outerdivjq = instance.divjq.closest(JS9.lightOpts[JS9.LIGHTWIN].top);
        } else {
    	// save id
    	instance.id = divjq.attr("id") || plugin.name;
    	// save type
    	instance.winType = "div";
    	// should this plugin div be hidden at the start?
    	if( JS9.inArray(instance.name, JS9.globalOpts.hiddenPluginDivs) >=0 ){
    	    visible = "hidden";
    	}
    	// wrap the target div in a container div
    	divjq.wrap(`<div class='JS9PluginContainer' style='visibility: ${visible}'>`);
    	// this is the original div
    	instance.odivjq = divjq;
    	// this is the div which the instance sees
    	instance.divjq = divjq;
    	// add classes for easier CSS specification
    	instance.divjq.addClass(`${plugin.xclass}Plugin`).addClass("JS9Plugin");
    	// add id
    	if( !instance.odivjq.attr("id") ){
    	    instance.odivjq.attr("id", instance.id);
    	}
    	// the wrapper plugincontainer is the the outer div
    	instance.outerdivjq = instance.divjq.closest(".JS9PluginContainer");
    	// add the toolbar to the container, if necessary
    	if( divjq.data("toolbarseparate") !== false ){
    	    if( plugin.opts.toolbarSeparate || divjq.data("toolbarseparate") ){
    		ndiv = document.createElement("div");
    		ndiv.className = JS9.lightOpts[JS9.LIGHTWIN].dragBar.substr(1);
    		if( instance.divjq[0] && instance.divjq[0].parentNode ){
    		    instance.divjq[0].parentNode.insertBefore(ndiv, instance.divjq[0]);
    		}
    	    }
    	}
        }
        // backlink this instance into the plugin
        instance.plugin = plugin;
        // save original el so we know we have done this one
        instance.el = el;
        // mark as valid for display and execution
        // undefined => not created,  or "active" or "inactive"
        instance.status = "active";
        // save this instance globally
        plugin.instances.push(instance);
        // for virtual plugins, instantiate and backlink into all displays
        if( instance.winType === "virtual" ){
    	for(i=0; i<JS9.displays.length; i++){
    	    // look for displays to which we have not added this plugin
    	    if( !JS9.displays[i].pluginInstances[plugin.name] ){
    		// fake this display
    		instance.div = null;
    		instance.display = JS9.displays[i];
    		// instantiate
    		plugin.func.apply(instance, args);
    		// backlink
    		JS9.displays[i].pluginInstances[plugin.name] = instance;
    	    }
    	}
        } else {
    	// instantiate and backlink into the display
    	// div the old-fashioned way
    	instance.div = instance.divjq[0];
    	instance.outerdiv = instance.outerdivjq[0];
    	// set width and height on div which instance sees
    	if( plugin.opts.winDims ){
    	    // if either of these is not set, set size to defaults
    	    // as it turns out, sometimes one of them can be a tiny value (2)
    	    // when you still want to set the defaults. not sure why ...
    	    if( !instance.divjq.width()  || !instance.divjq.height() ){
    		instance.divjq.css("width", plugin.opts.winDims[0]);
    		instance.divjq.css("height", plugin.opts.winDims[1]);
    	    }
    	}
    	// find the display for this plugin, using data-js9id or instance id
    	divid = instance.divjq.data("js9id") || instance.id;
    	if( divid === "*" ){
    	    if( plugin.opts.dynamicSelect ){
    		// use first display as the primary for a dynamic plugin
    		instance.display = JS9.displays[0];
    		// this instance is dynamic
    		instance.isDynamic = true;
    		// we have a dynamically selected plugin
    		JS9.Dysel.addPlugins(plugin.name);
    		did = "*";
    	    } else {
    		JS9.error(`${plugin.name} is not dynamically selectable`);
    	    }
    	} else {
    	    instance.display = JS9.lookupDisplay(divid);
    	    did = instance.display.id;
    	}
    	// add the toolbar content, if necessary
    	html = divjq.data("toolbarhtml") || plugin.opts.toolbarHTML;
    	if( html ){
    	    // macro expand so we can add title automatically
    	    html = JS9.Image.prototype.expandMacro.call(null, html,
    		[{"name": "title", "value": plugin.opts.winTitle || ""}]);
    	    pdivjq = instance.divjq.closest(JS9.lightOpts[JS9.LIGHTWIN].drag);
    	    if( pdivjq.length === 0 ){
    		pdivjq = instance.divjq;
    	    }
    	    // add html to toolbar
    	    // add the display id to the toolbar, so buttons can find it
    	    ndiv = document.createElement("div");
    	    ndiv.className = `JS9PluginToolbar-${instance.winType}`;
    	    ndiv.style.zIndex = String(JS9.BTNZINDEX);
    	    ndiv.innerHTML = html;
    	    ndiv.dataset.displayid = did;
    	    if( pdivjq[0] && pdivjq[0].parentNode ){
    		pdivjq[0].parentNode.insertBefore(ndiv, pdivjq[0].nextSibling);
    	    }
    	}
    	instance.display.pluginInstances[plugin.name] = instance;
    	// call the init routine (usually a constructor)
    	// on entry: elements have already been defined in the context:
    	// this.div: the DOM element representing the div for this plugin
    	// this.divjq: wrapped collection representing the div for this plugin
    	// this.id: id of the div (or the plugin name as a default)
    	// this.plugin: plugin class object (user opts in opts subobject)
    	// this.winType:  "div" (in-page div) or "light" (from view menu)
    	// this.winHandle: handle returned from light window create routine
    	// this.display:  the display object associated with this plugin
    	// this.status: "active" or "inactive" or undefined
    	plugin.func.apply(instance, args);
    	// for a dynamic plugin, backlink this instance into all displays
    	if( did === "*" ){
    	    for(i=0; i<JS9.displays.length; i++){
    		// look for displays to which we have not added this plugin
    		if( JS9.displays[i].pluginInstances[plugin.name] ){
    		    // primary display
    		    instance.display  = JS9.displays[i];
    		} else {
    		    // backlink to primary
    		    JS9.displays[i].pluginInstances[plugin.name] = instance;
    		}
    	    }
    	}
        }
        // return the instance
        return instance;
    };
    
    // instantiate all plugins -- can be called repeatedly if new divs are added
    JS9.instantiatePlugins = function(){
        let i;
        const newPlugin = (plugin) => {
    	let j, k, instance;
    	// instantiate any divs not yet done
    	document.querySelectorAll(`div.${plugin.name}`).forEach((element) => {
    	    // new instance of this div-based plugin
    	    JS9.instantiatePlugin(element,
    				  plugin, null, plugin.opts.divArgs);
    	});
    	// if we have a non-visible plugin (no menu and no window dims)
    	// which is not instantiated, instantiate it now (e.g. regions)
    	if( !plugin.opts.menuItem && plugin.opts.winDims &&
    	    !plugin.opts.winDims[0] && !plugin.opts.winDims[1] ){
    	        JS9.instantiatePlugin(null, plugin, null, plugin.opts.divArgs);
    	}
    	// backlink new instances of any dynamic plugins
    	for(j=0; j<plugin.instances.length; j++){
    	    instance = plugin.instances[j];
    	    if( instance.isDynamic ){
    		for(k=0; k<JS9.displays.length; k++){
    		    if( !JS9.displays[k].pluginInstances[plugin.name] ){
    			JS9.displays[k].pluginInstances[plugin.name] = instance;
    		    }
    		}
    	    }
    	}
        };
        for(i=0; i<JS9.plugins.length; i++){
    	newPlugin(JS9.plugins[i]);
        }
    };
    
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallViewerPlugins = JS9InstallViewerPlugins;
}
