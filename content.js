/**
 * @file content.js
 * @description Injects the interceptor script and acts as a message bridge.
 */

// --- CONFIGURATION ---
const config = {
  // NOTE: This might need to be adjusted to a relative path
  // depending on what you discovered during debugging.
  TARGET_URL: '/atlas/v1/purchase-history/v2/details',
  TARGET_METHOD: 'POST'
};

console.log('XHR Saver (content.js): Injecting interceptor script from file.');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('interceptor.js');
script.setAttribute('data-config', JSON.stringify(config));

(document.head || document.documentElement).appendChild(script);

script.onload = function() {
  this.remove();
};

// Listen for the message from the injected script (interceptor.js)
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves and for the correct type
  if (event.source === window && event.data.type && event.data.type === "FROM_PAGE_SCRIPT") {
    console.log("XHR Saver (content.js): Received data from injected script. Forwarding to background.");
    // Forward the response data AND the postBody to the background script
    chrome.runtime.sendMessage({
      action: "saveJson",
      data: event.data.data,
      postBody: event.data.postBody // Pass the new postBody data
    });
  }
}, false);

