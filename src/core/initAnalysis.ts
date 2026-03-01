// @ts-nocheck
/* JS9 browser viewer core. Attribution is centralized in README.md. */

/*global document */

"use strict";

function JS9InstallInitAnalysis(JS9){
    // init analysis
    JS9.initAnalysis = function(){
        // for analysis forms, Enter should not Submit, but allow specification
        // of the name of an element to click
        document.addEventListener("keypress", (e) => {
	    const target = e.target;
	    let id;
	    let el;
	    if( !target || !(target instanceof Element) ){
		return;
	    }
	    if( !target.closest(".js9AnalysisForm, .js9Form, .js9Input") ){
		return;
	    }
	    if( e.key !== "Enter" && e.which !== 13 && e.keyCode !== 13 ){
		return;
	    }
	    id = target.getAttribute("data-enterfunc");
	    if( !id ){
		return;
	    }
	    e.preventDefault();
	    // look at children (key event in a form)
	    el = target.querySelector(`[name='${id}']`);
	    if( el ){
		el.click();
		return false;
	    }
	    // look at siblings (key event on input not in a form)
	    if( target.parentElement ){
		el = target.parentElement.querySelector(`:scope > [name='${id}']`);
		if( el ){
		    el.click();
		    return false;
		}
	    }
        });
    };
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallInitAnalysis = JS9InstallInitAnalysis;
}
