/**
 * @file background.js
 * @description This is the service worker for the extension. It listens for messages
 * from the content script and handles the file download process.
 */

// Listen for a message from the content script
console.log("XHR Saver (background.js): load script");
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("XHR Saver (background.js): Received message:");
  if (message.action === "saveJson") {
    console.log("XHR Saver (background.js): Received saveJson message:", {
      data: message.data ? message.data.substring(0, 100) + '...' : 'N/A',
      postBody: message.postBody
    });

    const subDirectory = 'gerbes/';
    let filename = 'purchase-history-details.json'; // Default filename

    // Try to construct the dynamic filename from the POST body
    try {
      // Ensure postBody is a string that can be parsed
      if (message.postBody && typeof message.postBody === 'string') {
        const parsedBody = JSON.parse(message.postBody);
        
        // The body could be an array with one object, or just the object itself.
        // We normalize it to just be the object we care about.
        const postParams = Array.isArray(parsedBody) ? parsedBody[0] : parsedBody;

        // Ensure we have a valid object to work with
        if (postParams && typeof postParams === 'object') {
            const { divisionNumber, storeNumber, transactionDate, terminalNumber, transactionId } = postParams;
            
            // Validate that all required parts for the filename are present
            if (divisionNumber && storeNumber && transactionDate && terminalNumber && transactionId) {
              filename = `${divisionNumber}~${storeNumber}~${transactionDate}~${terminalNumber}~${transactionId}.json`;
              console.log(`XHR Saver (background.js): Successfully generated dynamic filename: ${filename}`);
            } else {
              console.warn("XHR Saver (background.js): POST body object was missing one or more required properties for the filename. Using default.", postParams);
            }
        } else {
             console.warn(`XHR Saver (background.js): Normalized POST body is not a valid object or the array was empty. Using default filename.`);
        }
      } else {
        console.warn(`XHR Saver (background.js): POST body not available or not a string. Using default filename. Type: ${typeof message.postBody}`);
      }
    } catch (e) {
      console.error("XHR Saver (background.js): Error parsing POST body. Using default filename.", e);
    }
    
    // --- Final, robust check for existing file before downloading ---
    const fullPath = subDirectory + filename;
    try {
        // 1. Search broadly using the filename itself as a query. This is an efficient first pass.
        const searchResults = await chrome.downloads.search({ query: [filename], state: "complete" });

        // 2. Iterate through results to find an exact path match at the end of the string.
        const fileAlreadyExists = searchResults.some(downloadItem => {
            // Normalize path separators (\ to /) for a reliable comparison across OSes.
            const normalizedItemPath = downloadItem.filename.replace(/\\/g, '/');
            // An absolute path (normalizedItemPath) will end with the relative path (fullPath) if it's the same file.
            return normalizedItemPath.endsWith('/' + fullPath);
        });

        if (fileAlreadyExists) {
            console.log(`XHR Saver (background.js): File ${fullPath} already exists in download history. Skipping download.`);
            sendResponse({ status: "skipped", reason: "File already exists" });
            return; // Exit without downloading
        }
    } catch (e) {
        console.error("XHR Saver (background.js): Error searching for existing downloads. Proceeding with download attempt.", e);
    }

    const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(message.data)));

    // Use the downloads API to save the file
    chrome.downloads.download({
      url: dataUrl,
      filename: fullPath, // Use the full path
      saveAs: false // Set to false to download automatically
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("XHR Saver (background.js): Download failed:", chrome.runtime.lastError);
        sendResponse({ status: "failed", error: chrome.runtime.lastError.message });
      } else {
        console.log(`XHR Saver (background.js): Download for ${fullPath} initiated with ID: ${downloadId}`);
        sendResponse({ status: "success" });
      }
    });

    // Return true to indicate that we will send a response asynchronously.
    return true;
  }
});

console.log("XHR Saver (background.js): Service worker started.");

