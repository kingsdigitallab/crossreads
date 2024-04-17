/**
 * A wrapper around SaxonJS so it can be imported as
 *  ECMAScript/ES module from nodejs and the browser.
 * 
 * Saxon-js ES module can't be imported from browser.
 * It provides a separate script that can only be loaded
 * with <script> element as it sets window.SaxonJS.
 */
const isBrowser = (typeof window !== "undefined");
export let SaxonJS = null;

if (isBrowser) {
  // regretably we have to resort to this ugly script injection.
  // because saxon-js does not provide a module for browser.
  // i.e. this won't work, whatever source saxon-js is mapped to
  // import * as SaxonJS from 'saxon-js';
  // import SaxonJS from 'saxon-js';
  let url = 'assets/SaxonJS2.rt.js';
  let script = document.createElement("script");
  document.getElementsByTagName("script")[0].parentNode.appendChild(script);
  script.addEventListener('load', () => { 
    SaxonJS = window.SaxonJS;
  });    
  script.src = url;
} else {
  SaxonJS = (await import('saxon-js')).default;
}

