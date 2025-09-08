/**
 * @file interceptor.js
 * @description This script is injected directly into the page's context to intercept network requests.
 */

(function() {
  const currentScript = document.currentScript;
  const configString = currentScript.getAttribute('data-config');
  let config;

  try {
    config = JSON.parse(configString);
  } catch (e) {
    console.error('XHR Saver (interceptor.js): Failed to parse configuration from script attribute.', e);
    return;
  }
  
  if (!config) {
    console.error('XHR Saver (interceptor.js): Configuration object not found in script attribute.');
    return;
  }
  
  console.log('XHR Saver (interceptor.js): Script injected and running with config:', config);

  const { TARGET_URL, TARGET_METHOD } = config;

  /**
   * Posts a message to the content script with the data to be saved.
   * @param {string} jsonDataString - The JSON response data as a string.
   * @param {string} postBody - The JSON POST body as a string.
   */
  function sendDataToContentScript(jsonDataString, postBody) {
    try {
      JSON.parse(jsonDataString); // Validate that the response is valid JSON
      console.log("XHR Saver (interceptor.js): Valid JSON found. Posting to content script with POST body.");
      window.postMessage({
        type: "FROM_PAGE_SCRIPT",
        data: jsonDataString,
        postBody: postBody // Include the post body in the message
      }, "*");
    } catch (e) {
      console.warn("XHR Saver (interceptor.js): Response was not valid JSON, so it won't be saved.", e);
    }
  }

  // --- PATCH FOR FETCH API ---
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const isTargetRequest =
      (options?.method?.toUpperCase() === TARGET_METHOD) &&
      String(url).includes(TARGET_URL);

    if (isTargetRequest) {
      console.log(`XHR Saver (interceptor.js): MATCHED fetch() to ${url}`);
    }

    return originalFetch.apply(this, arguments).then(response => {
      if (isTargetRequest) {
        const clonedResponse = response.clone();
        clonedResponse.text().then(textData => {
          // options.body contains the POST data for fetch
          sendDataToContentScript(textData, options.body);
        });
      }
      return response;
    });
  };

  // --- PATCH FOR XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._requestMethod = method;
    this._requestURL = url;
    return originalOpen.apply(this, arguments);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) { // Capture the body argument
    this.addEventListener('load', () => {
      const isTargetRequest =
        this._requestMethod.toUpperCase() === TARGET_METHOD &&
        this._requestURL.includes(TARGET_URL);

      if (isTargetRequest) {
        console.log(`XHR Saver (interceptor.js): MATCHED XHR to ${this._requestURL}`);
        // The 'body' from the send function is the POST data for XHR
        sendDataToContentScript(this.responseText, body);
      }
    });
    return originalSend.apply(this, arguments);
  };
})();

