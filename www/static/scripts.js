$(document).ready(function() {
    const serverUrl = 'https://8c31be54e6fac00f.ngrok.app/';
    
// ===============================================
    // PLATFORM DETECTION
// ===============================================
    // Detect the platform using Capacitor
    const capPlatform = (typeof Capacitor !== 'undefined') ? Capacitor.getPlatform() : 'web';
    const isWeb = capPlatform === 'web';

    // Initialize device type variables
    let isMobile  = false;
    let isTablet  = false;
    let isDesktop = false;
    let isIOS     = false;
    let isAndroid = false;
    let isMacOS   = false;

    // We'll store the OS name here for the debug banner
    let osName = '';

    // Detect the platform using Bowser (must be included in your page)
    if (typeof bowser !== 'undefined') {
      const browser = bowser.getParser(window.navigator.userAgent);

      // Determine device type (mobile/tablet/desktop)
      const platformType = browser.getPlatformType(true);
      isMobile  = (platformType === 'mobile');
      isTablet  = (platformType === 'tablet');
      isDesktop = (platformType === 'desktop');

      // Add classes to <body> based on device type
      if (isMobile) {
        document.body.classList.add('is-mobile');
      } else if (isTablet) {
        document.body.classList.add('is-tablet');
      } else if (isDesktop) {
        document.body.classList.add('is-desktop');
      }

      // Check userAgent for iPadOS:
      //   iPadOS sometimes reports "Macintosh" in UA + has touch events
      const ua = window.navigator.userAgent;
      const isIpadOS = ua.includes('Macintosh') && 'ontouchend' in document;

      if (isIpadOS) {
        // Bowser might detect as 'macOS', so we override for iPad.
        isTablet = true;   // Typically iPad is a tablet
        isDesktop = false; // Prevent “desktop” classification
        document.body.classList.add('ipad-os-device');

        // For the debugging banner, set osName to 'ipados'
        osName = 'iPadOS';
      } else {
        // Normal logic from Bowser for iOS, Android, etc.
        osName  = (browser.getOSName() || '').toLowerCase();
        isIOS     = (osName === 'ios');
        isAndroid = (osName === 'android');
        isMacOS   = (osName === 'macos');

        if (isIOS) {
          document.body.classList.add('ios-device');
        } else {
          document.body.classList.add('non-ios-device');
        }
      }

      // Apply lock scrolling only if Android
     /* if (isAndroid) {
        document.documentElement.classList.add('mobile-tablet-lock-scroll');
        document.body.classList.add('mobile-tablet-lock-scroll');
      } else {
        document.documentElement.classList.remove('mobile-tablet-lock-scroll');
        document.body.classList.remove('mobile-tablet-lock-scroll');
      }*/

      // Debugging banner

    //   const browserName    = browser.getBrowserName() || '';
    //   const browserVersion = browser.getBrowserVersion() || '';

    //   const deviceInfo = `
    //       <div style="position: fixed; bottom: 0; left: 0; 
    //                   background: rgba(255,255,0,0.8); z-index: 9999; 
    //                   padding: 5px; font-size: 12px;">
    //           isMobile: ${isMobile}, isTablet: ${isTablet}, isDesktop: ${isDesktop}<br>
    //           OS: ${osName}, Browser: ${browserName} ${browserVersion}
    //       </div>
    //   `;
    //   document.body.insertAdjacentHTML('beforeend', deviceInfo);

    } else {
      console.error('Bowser library is not loaded or "bowser" is undefined.');
      // Fallback detection or default to desktop
      isDesktop = true;
      document.body.classList.add('is-desktop', 'non-ios-device');
    }



// ===============================================
    // VARIABLE DECLARATIONS
// ===============================================

    let isFirstMessageAfterOliClick = false;
    let hasImageButtonBeenClicked = false;

    // Variables to keep track of the current book and chapter titles
    let currentAuthor = '';
    let currentBookTitle = '';
    let currentChapterTitle = '';
    
    let oliMetadata = {
        author: '',
        chapterTitle: '',
        bookTitle: ''
    };

    let dynamicOliMetadata = {
        author: '',
        chapterTitle: '',
        bookTitle: ''
    };

    // Variables to track resizing state
    let isResizing = false;
    let lastDownX = 0;


// Cache DOM elements
const searchSpace = document.querySelector('.search-space');
const resizer = document.getElementById('chatbox-resizer');
const chatInput = document.getElementById('chat-input');
const mainContent = document.querySelector('.container');
const bottomFlexBox = document.getElementById('bottom-flex-box');
const $searchToggle = $('#searchToggle');
const $searchOptionsFrame = $('.search-options-dropdown-frame'); // Cache the new frame
const $searchBtn = $('#search-btn');
const $vectorSamples = $('.vector-sample-questions');
const $keywordSamples = $('.keyword-sample-questions');
const sampleQuestions = document.querySelector('.sample-questions');
const fullText = document.getElementById('full-text');

let readingModeActivated = false; // Global flag to track if reading mode is active


// From your scripts.js
const seekOptionsHeader = document.querySelector('.search-options-dropdown-frame .seek-options-header');
const seekOptionsContent = document.querySelector('.search-options-dropdown-frame .seek-options-content');
const dropdownFrame = document.querySelector('.search-options-dropdown-frame');

if (seekOptionsHeader && seekOptionsContent && dropdownFrame) {

    function openSeekOptions() {
        seekOptionsContent.classList.add('open');
        seekOptionsHeader.classList.remove('collapsed');
        dropdownFrame.classList.remove('inner-collapsed'); // Correct: removes class on open

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const requiredHeight = seekOptionsContent.scrollHeight + 0;
                seekOptionsContent.style.maxHeight = requiredHeight + "px";
            });
        });
    }

    function closeSeekOptions() {
        seekOptionsContent.classList.remove('open');
        seekOptionsHeader.classList.add('collapsed');
        dropdownFrame.classList.add('inner-collapsed'); // Correct: adds class on close
        seekOptionsContent.style.maxHeight = '0';
    }

    // Initial state:
    if (seekOptionsHeader.classList.contains('collapsed')) {
        closeSeekOptions();
    } else {
        openSeekOptions(); // Default to open, so inner-collapsed is removed.
    }

    seekOptionsHeader.addEventListener('click', function() {
        if (seekOptionsContent.classList.contains('open')) {
            closeSeekOptions();
        } else {
            openSeekOptions();
        }
    });
}

    // Settings Menu Toggle (if you have one, or adapt)
    const settingsMenuBtn = document.getElementById("settings-menu-btn");
    const settingsMenuDropdown = document.getElementById("settings-menu-dropdown");
    const closeSettingsMenuBtn = settingsMenuDropdown ? settingsMenuDropdown.querySelector(".close-menu-btn") : null;

    if (settingsMenuBtn && settingsMenuDropdown) {
        settingsMenuBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            settingsMenuDropdown.classList.toggle("active");
            settingsMenuBtn.setAttribute('aria-expanded', settingsMenuDropdown.classList.contains('active'));
        });
    }

    if (closeSettingsMenuBtn) {
        closeSettingsMenuBtn.addEventListener("click", function () {
            settingsMenuDropdown.classList.remove("active");
            if (settingsMenuBtn) {
                settingsMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Main Menu Toggle (from your existing scripts.js)
    const mainMenuBtn = document.getElementById("main-menu-btn"); // Assuming this is for the book list
    const mainMenuDropdown = document.getElementById("main-menu-dropdown");
    const closeMainMenuBtn = mainMenuDropdown ? mainMenuDropdown.querySelector(".close-menu-btn") : null;

    // Existing main menu button (logo button) functionality - adapted
    // Ensure the main-menu-btn is the correct one (your logo button)
    const mainMenuLogoBtn = document.querySelector(".search-image #main-menu-btn"); // More specific selector for the logo button
    if (mainMenuLogoBtn && mainMenuDropdown) { // Ensure mainMenuDropdown is not null
        mainMenuLogoBtn.addEventListener("click", function (event) {
            // This button's primary role seems to be opening a new window.
            // If it's ALSO supposed to toggle the main menu, that logic needs to be here.
            // For now, keeping its original JS functionality of opening a link.
            // window.open("https://youtu.be/otECbl2kOuc&autoplay=1", "_blank");
            // console.log("Main menu (logo) button clicked - opening video link");

            // If you want it to ALSO toggle the book menu, uncomment and adapt:
            /*
            event.stopPropagation();
            mainMenuDropdown.classList.toggle("active");
            mainMenuLogoBtn.setAttribute('aria-expanded', mainMenuDropdown.classList.contains('active'));
            */
        });
    }


    if (closeMainMenuBtn) {
        closeMainMenuBtn.addEventListener("click", function () {
            if (mainMenuDropdown) { // Check if mainMenuDropdown exists
                mainMenuDropdown.classList.remove("active");
            }
            if (mainMenuLogoBtn) { // Check if mainMenuLogoBtn exists
                 mainMenuLogoBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Close dropdowns if clicked outside
    document.addEventListener("click", function (event) {
        if (mainMenuDropdown && !mainMenuDropdown.contains(event.target) && mainMenuLogoBtn && !mainMenuLogoBtn.contains(event.target)) {
            mainMenuDropdown.classList.remove("active");
            if (mainMenuLogoBtn) mainMenuLogoBtn.setAttribute('aria-expanded', 'false');
        }
        if (settingsMenuDropdown && !settingsMenuDropdown.contains(event.target) && settingsMenuBtn && !settingsMenuBtn.contains(event.target)) {
            settingsMenuDropdown.classList.remove("active");
            if (settingsMenuBtn) settingsMenuBtn.setAttribute('aria-expanded', 'false');
        }
    });




// ===============================================
// SEARCH FUNCTIONS AND UI
// ===============================================
    // --- Load and Apply Saved Preferences ---
    try {
        const savedScope = localStorage.getItem('searchScopePreference');
        if (savedScope && ['all', 'aurobindo', 'mother'].includes(savedScope)) {
            $('input[name="searchScope"][value="' + savedScope + '"]').prop('checked', true);
            console.log("Applied saved search scope:", savedScope);
        } else {
            $('input[name="searchScope"][value="all"]').prop('checked', true);
            if (savedScope) console.warn("Invalid saved scope found ('"+ savedScope +"'), defaulting to 'all'.");
            else console.log("No saved scope found, defaulting to 'all'.");
        }
    } catch (e) {
        console.error("Error retrieving or applying saved scope preference:", e);
        $('input[name="searchScope"][value="all"]').prop('checked', true);
    }
    // *** End Load Scope ***

       // *** Save Scope Preference on Change (Reverted to this method) ***
       $('input[name="searchScope"]').on('change', function() {
        const selectedValue = $(this).val();
        try {
            localStorage.setItem('searchScopePreference', selectedValue);
            console.log("Saved search scope preference:", selectedValue);
        } catch (e) {
            console.error("Error saving scope preference to localStorage:", e);
        }
    });
// Initially hide the loader and the full-text section
$("#loader-container").hide();
$('#full-text').hide();

// Code for the search box functionality
// 1. When the search input (#query) is focused, the current text will be selected.
// 2. Prevent the default mouseup behavior to avoid losing the text highlight.
$('#query')
  .on('focus', function() {
    // Automatically select all text when the input gains focus
    $(this).select();
  })
  .on('mouseup', function(e) {
    // Prevent the default mouseup action so that the text remains selected
    e.preventDefault();
    // Stop the event from bubbling up to other handlers
    e.stopPropagation();
  });

// Apply custom styles for the selection in the #query input.
// This adds a style tag to the head, changing the selection background color.
$('<style>')
  .prop('type', 'text/css')
  .html(`
    #query::selection {
        background-color: #E0E0E0;
    }
    #query::-moz-selection {
        background-color: #E0E0E0;
    }
  `)
  .appendTo('head');

// Variables and functions to handle the "loading" animation
let fadeInterval;

/**
 * startLoaderAnimation:
 * Displays a loader container with a book icon (or any loader element).
 * The icon repeatedly fades in and out to indicate something is loading.
 */
function startLoaderAnimation() {
  // Show the loader container and center its contents
  $("#loader-container").css({
    'display': 'flex',
    'justify-content': 'center',
    'align-items': 'center',
    'margin-top': '20px'
  });

  // Style the loader icon
  $(".book-loader").css({
    'font-size': '36px',
    'color': '#228B22',   // A green shade
    'opacity': 1
  });

  // Start a fade animation: toggles between 1 and 0.6 opacity
  let opacity = 1;
    // Clear any existing interval to prevent multiple animations
    clearInterval(fadeInterval);
    fadeInterval = setInterval(function() {
        // Toggle opacity between 1 and 0.6
        opacity = opacity > 0.6 ? 0.6 : 1;
        // Animate the opacity change smoothly
        $(".book-loader").animate({ 'opacity': opacity }, 600, 'linear'); // Faster transition
    }, 700); // Shorter interval for faster fade timing
}

/**
 * stopLoaderAnimation:
 * Stops the fade animation and hides the loader container.
 */
function stopLoaderAnimation() {
  // Clear the interval that toggles opacity
  clearInterval(fadeInterval);
  // Hide the entire loader container
  $("#loader-container").hide();
}


// Handle clicks on sample questions
$('.sample-question').click(function(e) {
    e.preventDefault(); // Prevent default link behavior

    var questionText = $(this).text().trim();
    $('#query').val(questionText);
    

    // Trigger the search
    $('#search-btn').click();
});

// Updated Search Button Click Handler 
$searchBtn.click(function() {
var query = $('#query').val();
startLoaderAnimation();

$('#results').empty(); // Clear previous results
$('.sample-questions').hide(); // Hide sample questions when search is initiated

 // ***** Hide summary button and container initially on new search *****
 $('#summarize-results-btn').hide();
 $('#ai-summary-container').hide().find('#ai-summary-content').empty(); // Hide and clear previous summary

// Add hidden class to open_chatbot button when not in flex-box and zoom_to_top button
$('.open_chatbot:not(.in-flex-box), .zoom_to_top').addClass('hidden');



// Determine the search mode and set the appropriate URL
var isVectorSearch = !$searchToggle.is(':checked');
var searchUrl = isVectorSearch ? serverUrl + '/api/search' : serverUrl + '/api/keyword-search';
console.log("Search URL:", searchUrl);

$.post(searchUrl, {
    query:  query,
    scope:  $('#selectedScope').val() || 'all'   // <-- NEW LINE
}, function (data) {
    console.log("Search results received", data);
    stopLoaderAnimation();

    // If no results are found, show a message and re-display sample questions
    if (!data || data.length === 0) {
        $('#results').html('<p>No results found. Please try a different query.</p>');
        $('.sample-questions').show();
        $('#summarize-results-btn').hide();
        $('#results').removeData('fullResultsData'); // Clear stored data
         // **** ADD THIS LINE ****
         $('#info-message').removeClass('hidden');
         // **********************
        return;
    }
 // Store the full results data for potential summarization
 $('#results').data('fullResultsData', data);
 console.log("Stored full results data.");

    var $resultsContainer = $('<div id="top-results"></div>');

    data.forEach(function(result, index) {
        // Use highlighted_text for preview, fallback to text if not available
        var preview = result.highlighted_text || result.text;
        
        // --- START OF ADDED CODE ---
    // Remove specific bracketed strings (like [CWSA - ...]) from the preview
    if (preview) { // Ensure preview is not null or undefined
        preview = preview.replace(/\s*\[(CWSA|CWM|Mother['’]s Agenda)\s*[-–]\s*'([^']+)'\s*,\s*'([^']+)'\]\s*/g, '');
    }
    // --- END OF ADDED CODE ---
        
        preview = preview.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

        // Truncate the preview to approximately 100 words, preserving HTML tags
        var previewWords = preview.split(" ");
        if (previewWords.length > 100) {
            preview = previewWords.slice(0, 100).join(" ") + "...";
        }

        // Conditionally display the relevance score only for vector search
        var relevanceScoreHtml = '';
        /*if (isVectorSearch && result.relevance_score !== undefined) {
            relevanceScoreHtml = `
                <div class="result-score">
                    Relevance Score: ${result.relevance_score.toFixed(2)}
                </div>
            `;
        }*/

        var resultItem = `
            <div class="result-item">
                <div class="result-preview">${preview}</div>
                <div class="result-metadata">
                    ${result.author || 'Unknown Author'}, 
                    ${result.book_title ? result.book_title.trim() : 'Unknown Book'}, 
                    "${result.chapter_title ? result.chapter_title.trim() : 'Unknown Chapter'}"
                </div>
                ${relevanceScoreHtml}
                <div class="result-actions">
                    <button class="view-detail-link" 
                            data-id="${result.search_id}" 
                            data-file-path="${result.file_path}" 
                            data-book-title="${result.book_title ? result.book_title.trim() : 'Unknown Book'}" 
                            data-author="${result.author || 'Unknown Author'}" 
                            data-chapter-title="${result.chapter_title ? result.chapter_title.trim() : 'Unknown Chapter'}">
                        Text
                    </button>
                    <button class="oli-button" 
                            data-full-text="${encodeURIComponent(result.text)}" 
                            data-author="${result.author || 'Unknown Author'}" 
                            data-chapter-title="${result.chapter_title ? result.chapter_title.trim() : 'Unknown Chapter'}" 
                            data-book-title="${result.book_title ? result.book_title.trim() : 'Unknown Book'}">
                        Oli!
                    </button>
                </div>
            </div>
        `;

        // Append the resultItem to the results container
        $resultsContainer.append(resultItem);
    });

    // Append the results container to the results section
    $('#results').append($resultsContainer);

 // ***** Show the Summarize button IF there are results *****
 if (data.length > 0) {
    $('#summarize-results-btn').show();
    console.log("Summarize button shown."); // Debug log
}

}).fail(function(jqXHR, textStatus, errorThrown) {
    // --- Failure Callback ---
    console.log("Search request failed", textStatus, errorThrown);
    stopLoaderAnimation(); // Stop loader animation
    $('#results').prepend('<p>An error occurred while searching. Please try again.</p>');
    $('.sample-questions').show(); // Show sample questions again
    $('#summarize-results-btn').hide(); // Hide button on failure
    // Clear any previously stored results data
    $('#results').removeData('fullResultsData');
     // Optionally show the message on failure too
     $('#info-message').removeClass('hidden');
});
});


// Show sample questions if the search input is cleared
$('#query').on('input', function() {
    if ($(this).val().trim() === '') {
        $('#results').empty();
        $('.sample-questions').show(); // Show sample questions when input is empty
        $('#summarize-results-btn').hide(); // Hide button
        $('#ai-summary-container').hide().find('#ai-summary-content').empty(); // Hide and clear summary
        // Clear any previously stored results data
        $('#results').removeData('fullResultsData');
         // **** ADD THIS LINE ****
         $('#info-message').removeClass('hidden');
         // **********************
    }
});


//==========================================
//SUMMARIZE BUTTON FUNCTIONALITY
//==========================================

// (Make sure markdownit and DOMPurify are loaded/initialized)
const md = window.markdownit(); // Initialize markdown-it

// --- Summarize Button Click Handler (Modified for Streaming) ---
$(document).on('click', '#summarize-results-btn', async function() { // Add async here
    // 0. Ensure chatbox is open
    $('#info-message').addClass('hidden'); // <-- ADD THIS LINE

    // 0. Ensure chatbox is open
    if (!$("#chatbox").hasClass("open")) {
        $(".open_chatbot").first().trigger("click");
    }
    $("#messages .empty-div").hide();

    // 1. Get messages area
    const messagesBox = document.querySelector("#messages .messages-box");
    if (!messagesBox) {
        console.error("Messages area not found.");
        return;
    }

    // 2. Create placeholder bubble
    let placeholderBubble = document.createElement("div");
    placeholderBubble.classList.add("box", "ai-message");
    let messageWrapper = document.createElement("div");
    messageWrapper.style.position = "relative";
    let placeholderMessage = document.createElement("div");
    placeholderMessage.classList.add("messages");
    placeholderMessage.style.whiteSpace = "pre-wrap";
    let meditatingElement = document.createElement("div"); // Separate element for "Meditating..."
    meditatingElement.classList.add("meditating-message"); // Use existing class
    meditatingElement.textContent = 'Creating the Olier Overview...';
    placeholderMessage.classList.add('is-loading'); // <-- ADD

    placeholderMessage.appendChild(meditatingElement); // Add meditating text initially
    messageWrapper.appendChild(placeholderMessage);
    placeholderBubble.appendChild(messageWrapper);
    messagesBox.appendChild(placeholderBubble);
    // --- UI Adjustments & Scroll (AI Placeholder) ---
    autoScrollEnabled = true; // Ensure scroll enabled for placeholder
    requestAnimationFrame(() => { // Ensure DOM update before scrolling
        scrollToBottom();
        if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
        if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
    });
   // --- END UI Adjustments (AI Placeholder) ---

    //scrollToBottom(); // Scroll initially

    // 2a. Animate dots (Keep this part)
    let dotCount = 0;
    const meditatingInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        if (meditatingElement && meditatingElement.parentNode) { // Check if element still exists
             meditatingElement.textContent = 'Creating the Olier Overview' + '.'.repeat(dotCount);
        } else {
             clearInterval(meditatingInterval); // Stop if element is removed
        }
    }, 500);

    // 3. Prepare payload (same as before)
    const fullResultsData = $('#results').data('fullResultsData') || [];
    if (fullResultsData.length === 0) {
        if (meditatingElement && meditatingElement.parentNode) meditatingElement.textContent = "No results available for summarization.";
        clearInterval(meditatingInterval);
        return;
    }
    const topResults = fullResultsData.slice(0, 10);
    const userQuery = $('#query').val().trim();
    const payload = {
        results: topResults,
        query: userQuery
    };

    // 4. Fetch request for streaming summarization
    try {
        const response = await fetch(serverUrl + 'api/summarize-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload) // Use body for fetch
        });

        if (!response.ok) {
            // Handle HTTP errors before trying to read stream
            clearInterval(meditatingInterval);
            if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove(); // Remove meditating text
            placeholderMessage.textContent = `Error: ${response.status} ${response.statusText}`;
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let firstChunkReceived = false;

        // Inside the 'while (true)' loop for summary streaming

        while (true) {
            const { done, value } = await reader.read();

            if (value) {
                // --- First chunk logic (keep as is) ---
                if (!firstChunkReceived) {
                    clearInterval(meditatingInterval);
                    if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
                    placeholderMessage.classList.remove('is-loading'); // <-- ADD
                    placeholderMessage.innerHTML = ''; // Clear "Meditating..."
                    firstChunkReceived = true;
                }
                // ---

                let chunk = decoder.decode(value);

                // Check for backend error signal (keep as is)
                if (chunk.startsWith("STREAM_ERROR:")) {
                     placeholderMessage.innerHTML = `<span style="color: red;">${chunk.substring("STREAM_ERROR:".length).trim()}</span>`;
                     console.error("Summarization stream error:", chunk);
                     break; // Stop processing stream on error
                }


                accumulatedText += chunk;

                // ***** CORRECTED RENDERING ORDER *****
                // 1. Render Markdown from the accumulated text FIRST.
                //    This will process any markdown syntax but leave the [Marker] tags untouched.
                let renderedMarkdown = md.render(accumulatedText);

                // 2. Now, replace the [Marker] tags within the RENDERED HTML string.
                let htmlWithLinks = replaceReferenceMarkers(renderedMarkdown);

                // 3. Sanitize the final HTML which now contains rendered markdown AND the links.
                let cleanHtml = DOMPurify.sanitize(htmlWithLinks);

                // 4. Update the DOM.
                placeholderMessage.innerHTML = cleanHtml;
                //messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // ***** END OF CORRECTED RENDERING ORDER *****


                // --- UI Adjustments (keep as is) ---
                 if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                 if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                 
                 
                 //scrollToBottom(); // Keep scrolling as content arrives
                 // ---
            }

            if (done) {
                // --- Final UI Adjustments and Button Addition (keep as is) ---
                clearInterval(meditatingInterval);
                if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();

                // Add copy button AFTER streaming is complete
                addCopyButton(messageWrapper);

                // Final layout adjustment after all content is rendered
                if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                scrollToBottom(); // Final scroll

                break; // Exit the loop
            }
        }
        
/*
        while (true) {
            const { done, value } = await reader.read();

            if (value) {
                // --- First chunk logic ---
                if (!firstChunkReceived) {
                    clearInterval(meditatingInterval);
                    if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
                    placeholderMessage.innerHTML = ''; // Clear "Meditating..."
                    firstChunkReceived = true;
                }
                // ---

                let chunk = decoder.decode(value);

                // Check for backend error signal
                if (chunk.startsWith("STREAM_ERROR:")) {
                     placeholderMessage.innerHTML = `<span style="color: red;">${chunk.substring("STREAM_ERROR:".length).trim()}</span>`;
                     console.error("Summarization stream error:", chunk);
                     break; // Stop processing stream on error
                }


                accumulatedText += chunk;

                // Render progressively with reference links
                let textWithLinks = replaceReferenceMarkers(accumulatedText);
                let dirtyHtml = md.render(textWithLinks); // Use markdown-it
                let cleanHtml = DOMPurify.sanitize(dirtyHtml); // Sanitize
                placeholderMessage.innerHTML = cleanHtml; // Update content


                // --- Optional: Adjust height during streaming (can be intensive) ---
                // You might throttle this if needed
                 if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                 if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                 scrollToBottom(); // Keep scrolling as content arrives
                 // ---
            }

            if (done) {
                clearInterval(meditatingInterval); // Ensure cleared if loop finishes quickly
                if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove(); // Ensure removed

                // Add copy button AFTER streaming is complete
                addCopyButton(messageWrapper);

                // Final layout adjustment after all content is rendered
                if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                scrollToBottom(); // Final scroll

                break; // Exit the loop
            }
        }
*/


    } catch (error) {
        clearInterval(meditatingInterval); // Clear interval on fetch error
        if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
        placeholderMessage.classList.remove('is-loading'); // <-- ADD
        placeholderMessage.textContent = "Sorry, an error occurred while creating the Olier Overview. Please try again later.";
        console.error("Summarization request failed:", error);
    }
}); // End of summarize button click handler
//Changes finished


// --- Helper function to replace new-style reference markers with clickable links ---
function replaceReferenceMarkers(text) {
    let refCounter = 0;           // ← add this
    // Matches:
    //  [CWSA – 'Book Title', 'Chapter Title']
    //  [CWM - 'Book Title', 'Chapter Title']
    //  [Mother’s Agenda - 'Book Title', 'Chapter Title']
    return text.replace(
        /\s*\[(CWSA|CWM|Mother['’]s Agenda)\s*[-–]\s*'(.+?)'\s*,\s*'(.+?)'\]\s*/g, 
        (match, series, book, chapter) => {
            refCounter++;  // 1, 2, 3, ...
       // *** CRITICAL FIX: Return string on ONE LINE, prefixed with &nbsp; ***
            return `&nbsp;<a href="#" class="reference-link" data-book-title="${book}" data-chapter-title="${chapter}"><span class="badge badge-secondary">R${refCounter}</span></a>`; 

        }
    );
    
}
  


// Helper function to set chat input value and trigger the send button
// (Keep this if your overall code uses it; otherwise, you may remove or adjust it as needed.)
function setInputValueAndSend(prompt) {
    const $chatInput = $('#chat-input');
    $chatInput.val(prompt);
    $chatInput.trigger('input'); // Trigger input event for auto-resize if needed
    console.log("Setting chat input and triggering send.");
    $('#send-btn').click();
}

// --- Event Listener for Reference Links ---
$(document).on('click', '.reference-link', function(e) {
    e.preventDefault();
    
    // ① Read the link’s data attributes up front
    const bookTitle   = $(this).data('book-title');
    const chapterTitle= $(this).data('chapter-title');
  
    // ② On mobile, first close the chat pane (reusing your existing toggle)
    if ($('body').hasClass('is-mobile') || $('body').hasClass('is-tablet')) {
      $('.close-icon').trigger('click');
  
      // ③ Wait for your 0.3s slide‑out animation to finish, then scroll the page
      setTimeout(() => {
        const $result = $(".result-item").filter(function(){
          const md = $(this).find(".result-metadata").text().toLowerCase();
          return md.includes(bookTitle.toLowerCase()) &&
                 md.includes(chapterTitle.toLowerCase());
        }).first();
        if (!$result.length) return;
  
        // ④ Scroll the window exactly as on desktop
        $('html, body').animate({
          scrollTop: $result.offset().top - 20
        }, 500);
  
        // ⑤ Highlight it
        $result.addClass('highlight-golden');
        setTimeout(() => $result.removeClass('highlight-golden'), 5000);
      }, 300);
  
      return;
    } 

  // 2️⃣ If on desktop, perform the normal scroll + highlight logic:
  
    //const bookTitle = $(this).data('book-title');
   // const chapterTitle = $(this).data('chapter-title');
   
   // Find the first result-item whose metadata includes both the book title and chapter title (ignoring case)
    const $result = $(".result-item").filter(function(){
        const metadata = $(this).find(".result-metadata").text();
        return metadata.toLowerCase().includes(bookTitle.toLowerCase()) &&
               metadata.toLowerCase().includes(chapterTitle.toLowerCase());
    }).first();

    if ($result.length) {
        $('html, body').animate({ scrollTop: $result.offset().top - 20 }, 500);
        $result.addClass('highlight-golden');
        setTimeout(() => {
            $result.removeClass('highlight-golden');
        }, 5000);
    }
});
// --- END OF SUMMARIZE BUTTON CLICK HANDLER ---


// Hide the View Detail loader and overlay initially
$("#view-detail-loader-container").hide();
$("#view-detail-loader-overlay").hide();

let viewDetailFadeInterval;
function startViewDetailLoaderAnimation() {
    // Show the overlay and loader
    $("#view-detail-loader-overlay").show();
    $("#view-detail-loader-container").show();

    // Prevent background scrolling
    $("body").css("overflow", "hidden");

    // Loader animation
    $(".book-loader").css({
        'font-size': '48px',
        'color': '#228B22',
        'opacity': 1
    });
    let opacity = 1;
    viewDetailFadeInterval = setInterval(function() {
        opacity = opacity > 0.6 ? 0.6 : 1;
        $(".book-loader").animate({ 'opacity': opacity }, 600, 'linear');
    }, 700);
}

function stopViewDetailLoaderAnimation() {
    clearInterval(viewDetailFadeInterval);
    // Hide the loader and overlay
    $("#view-detail-loader-container").hide();
    $("#view-detail-loader-overlay").hide();

    // Restore background scrolling
    $("body").css("overflow", "");
}



$(document).on('click', '.view-detail-link', function(e) {
e.preventDefault();
e.stopPropagation();
applyReadingMode();

// Retrieve data attributes
var id = $(this).data('id');
var originalFilePath = $(this).data('file-path');
var bookTitle = $(this).data('book-title');

// Update current book and chapter titles
currentBookTitle = bookTitle;
currentChapterTitle = ''; // Reset chapter title
updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);

// 1. Extract the bare filename from originalFilePath
var fileName = originalFilePath;
if (fileName.includes('/')) {
    fileName = fileName.substring(fileName.lastIndexOf('/') + 1);
}

// 2. If we're on the web, send just the bare filename to the server
//    If we're on mobile, also store the local path differently
var adjustedFilePath;
if (isWeb) {
    // Web: pass only the bare filename to /api/full-text
    adjustedFilePath = fileName;
} else {
    // Mobile: load from local assets
    adjustedFilePath = `static/HTML/${fileName}`;
}

// Now proceed to use adjustedFilePath accordingly

// Start the View Detail loader animation
startViewDetailLoaderAnimation();

// Clear and show the full-text container
$('#full-text').empty().show();
$('#full-text').append('<div id="full-text-content" class="full-text-content"></div>');



const contentLoaded = function() {
// Stop the loader animation
stopViewDetailLoaderAnimation();

// Call onContentLoaded if needed
requestAnimationFrame(function() {
    onContentLoaded();
});

// // Insert any additional logic if needed after loading
// if (typeof insertOliButtons === 'function') {
//     insertOliButtons();
// }

if (typeof initializeOliObserver === 'function' && typeof setupOliIntersection === 'function') {
    initializeOliObserver();
    setupOliIntersection();
}

// Variables to track when images are loaded and DOM is stable
let imagesLoaded = false;
let domStable = false;

// Function to check if both images are loaded and DOM is stable
function checkReady() {
    if (imagesLoaded && domStable) {
        proceedWithScrolling();
    }
}

// Images Loading
var images = $('#full-text-content img');
var totalImages = images.length;
var loadedImages = 0;

if (totalImages === 0) {
    // No images, proceed with imagesLoaded set to true
    imagesLoaded = true;
    checkReady();
} else {
    images.each(function() {
        if (this.complete) {
            imageLoaded();
        } else {
            $(this).on('load', imageLoaded);
            $(this).on('error', imageLoaded); // Handle errors to prevent hanging
        }
    });
}

function imageLoaded() {
    loadedImages++;
    if (loadedImages === totalImages) {
        imagesLoaded = true;
        checkReady();
    }
}

// DOM Mutations
const targetNode = document.getElementById('full-text-content');
const observerOptions = {
    childList: true,
    subtree: true
};
let mutationTimeout;

const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
        observer.disconnect();
        domStable = true;
        checkReady();
    }, 100); // Wait 100ms after the last mutation to consider DOM stable
});

observer.observe(targetNode, observerOptions);

// Fallback in case no mutations occur
setTimeout(() => {
    if (!domStable) {
        observer.disconnect();
        domStable = true;
        checkReady();
    }
}, 200); // Adjust timeout as necessary

// Function to proceed with scrolling after images and DOM are ready
// After ensuring the DOM is stable and images are loaded
function proceedWithScrolling() {
// Find the target paragraph
var $targetPara = $('p[search_id="' + id + '"]');

if ($targetPara.length) {
    // Hide the full text content initially
    $('#full-text-content').css('opacity', 0);

               // **Call functions that adjust the layout before fading in content**
    adjustChatboxStyle();

       // Ensure layout adjustments are complete
    requestAnimationFrame(function() {
        // Fade in the content
        $('#full-text-content').animate({ opacity: 1 }, 200, function() {
            // Scroll the target paragraph into view
            $targetPara[0].scrollIntoView({
                behavior: 'instant', // Use 'smooth' if desired
                block: 'center',     // Adjust alignment as needed
            });

        // Add highlight-pulse class to the target paragraph
        $targetPara.addClass('highlight-pulse');

        // Remove the pulsation after 3 seconds
        setTimeout(function() {
            $targetPara.removeClass('highlight-pulse');
        }, 3000);
    });
               });
} else {
    console.warn('Target paragraph not found.');
}
}};

const contentLoadFailed = function(jqXHR, textStatus, errorThrown) {
stopViewDetailLoaderAnimation();
$('#full-text-content').html('<p>An error occurred while loading the content.</p>');
console.error('Error loading full text:', jqXHR.status, textStatus, errorThrown);
};

// 3. Make the AJAX call
if (isWeb) {
// Web: fetch from server
$.get(serverUrl + '/api/full-text', { file_path: adjustedFilePath }, function(data) {
    $('#full-text-content').html(data);
    contentLoaded();
}).fail(contentLoadFailed);
} else {
// Mobile: load from local assets
$.get(adjustedFilePath, function(data) {
    $('#full-text-content').html(data);
    contentLoaded();
}).fail(contentLoadFailed);
}
});



// ===============================================
// CHATBOX ELEMENTS
// ===============================================

// Resizing functions for chatbox height to accommodate mobile keyboard

// 1) Android OR Tablet: use visualViewport or window resize
if (isAndroid || isTablet) {
  function setupViewportResizeListener() {
    if (window.visualViewport) {
      // Listen for viewport resize
      window.visualViewport.addEventListener('resize', adjustChatboxHeight);
    } else {
      // Fallback if visualViewport isn't supported
      window.addEventListener('resize', adjustChatboxHeight);
    }
  }
  setupViewportResizeListener();
}

// **** INSERT THE NEW ANDROID FOCUS LISTENER BLOCK HERE ****
// Add this block for Android focus handling
if (isAndroid) {
    const chatInput = document.getElementById('chat-input'); // Make sure chatInput is accessible here
    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            // Delay slightly to allow keyboard animation and resize event to settle
            setTimeout(() => {
                console.log("Re-adjusting height on Android focus after delay");
                adjustChatboxHeight(); 
                // Optionally, ensure the input is scrolled into view if needed,
                // though adjustChatboxHeight should handle the container positioning.
                // chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
            }, 250); // Adjust delay (e.g., 200-300ms) if needed
        });
    }
}
// End of new block
// ***************

/*
if (isIOS) {
    // On focus: change CSS directly
    chatInput.addEventListener('focus', () => {
      const chatInputContainer = document.getElementById('chat-input-container');
      chatInputContainer.style.position = 'absolute';
      chatInputContainer.style.bottom = 'auto';
      

    });
  
    // On blur: revert CSS
    chatInput.addEventListener('blur', () => {
      const chatInputContainer = document.getElementById('chat-input-container');
      chatInputContainer.style.position = '';
      chatInputContainer.style.bottom = '';
      
    });
  }
  */
/*
  if (isIOS) {
    const chatInput = document.getElementById('chat-input'); // Ensure chatInput is defined

    chatInput.addEventListener('focus', () => {
        document.body.classList.add('keyboard-open');
        // Use setTimeout to ensure layout adjustments have likely occurred
        setTimeout(() => {
           chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    });

    chatInput.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-open');
        // Optionally, trigger adjustChatboxHeight again if needed when keyboard hides
        // setTimeout(adjustChatboxHeight, 0);
    });
}
*/
// 2) iOS: Use visualViewport resize directly
if (isIOS && window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustChatboxHeight);
}
// Note: You might add a fallback 'resize' listener for older iOS versions
// else if (isIOS) {
//    window.addEventListener('resize', adjustChatboxHeight);
// }
    function adjustChatboxHeight() {
  
        // This function adjusts the chatbox height dynamically based on the viewport
        // and the dimensions of the top chatbox and chat input container. 
      
        const chatInputContainer = document.getElementById('chat-input-container');  // Reference to the chat input container element
        const messages = document.getElementById('messages');                       // Reference to the messages container element
        const topChatbox = document.querySelector('.top-chatbox');                  // Reference to the top chatbox element
      
        // If any of these elements are missing, we won't proceed with the height adjustment
        if (!chatInputContainer || !messages || !topChatbox) {
          return;
        }
      
        // Determine the height of the visible viewport (prioritizing window.visualViewport, then fallback to window.innerHeight)
        let viewportHeight = window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight;
      
        // Find how far down the chatbox starts from the top of the screen
        let chatboxTopOffset = chatbox.getBoundingClientRect().top;
        // Calculate remaining space below the chatbox top offset
        let availableHeight = viewportHeight - chatboxTopOffset;
      
        // Set the chatbox element's height to this available space
        chatbox.style.height = `${availableHeight}px`;
      
        // Get the heights of the chat input container and the top chatbox
        const chatInputContainerHeight = chatInputContainer.offsetHeight;
        const topChatboxHeight = topChatbox.offsetHeight;
        // The remaining space is allocated for the messages area
        const messagesHeight = availableHeight - topChatboxHeight - chatInputContainerHeight;
      
        // Adjust the messages container height
        messages.style.height = `${messagesHeight}px`;
      
        if (autoScrollEnabled && messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
       }
   
      
      }
      

  
  // Adjust Chatbox Style Function 
function adjustChatboxStyle() {
    // Sets styling for the chatbox based on mobile/desktop and whether it's open or closed.
  
    if (isMobile) {
      // If on mobile, the chatbox takes up the full width.
      chatbox.style.width = '100%';
    } else {
      // On desktop/tablet, we check for a previously stored width in localStorage.
      let storedChatboxWidth = localStorage.getItem('chatboxWidth');
      if (storedChatboxWidth) {
        // If found, use the stored width.
        chatbox.style.width = storedChatboxWidth + 'px';
      } else {
        // Otherwise, default to 40% width.
        chatbox.style.width = '40%';
      }
    }
  
    // Fix the chatbox at the top-right position of the viewport.
    chatbox.style.top = '0';
    chatbox.style.right = '0';
    chatbox.style.position = 'fixed';
  
    // Check if the chatbox is currently "open".
    if (chatbox.classList.contains('open')) {
      // Display the chatbox if open.
      chatbox.style.display = 'block';
  
      if (isMobile) {
        // On mobile when open, hide the main content and bottom flex box.
        mainContent.style.visibility = 'hidden';
        bottomFlexBox.style.visibility = 'hidden';
  
        // Position the chat input container at the bottom, fixed.
        const chatInputContainer = document.getElementById('chat-input-container');
        chatInputContainer.style.position = 'fixed';
        chatInputContainer.style.bottom = '0';
      } else {
        // On desktop, keep main content visible and recalculate widths.
        mainContent.style.visibility = 'visible';
        let chatboxWidth = chatbox.offsetWidth;
        let mainContentWidth = document.body.clientWidth - chatboxWidth;
        mainContent.style.width = mainContentWidth + 'px';
        mainContent.style.marginRight = chatboxWidth + 'px';
        mainContent.style.marginLeft = '0';
  
        // Same for bottom flex box: adjust visibility and width.
        bottomFlexBox.style.visibility = 'visible';
        bottomFlexBox.style.width = mainContentWidth + 'px';
        bottomFlexBox.style.marginRight = chatboxWidth + 'px';
        bottomFlexBox.style.marginLeft = '0';
      }
  
      // Move the chatbox fully into view.
      chatbox.style.transform = 'translateX(0)';
    } else {
      // If the chatbox is not open, main content spans the full screen.
      mainContent.style.visibility = 'visible';
      mainContent.style.width = '100%';
      mainContent.style.marginRight = 'auto';
      mainContent.style.marginLeft = 'auto';
  
      // The bottom flex box also reverts to full width and is visible.
      bottomFlexBox.style.visibility = 'visible';
      bottomFlexBox.style.width = '100%';
      bottomFlexBox.style.marginRight = '0';
      bottomFlexBox.style.marginLeft = '0';
  
      // Slide the chatbox off the screen to the right.
      chatbox.style.transform = 'translateX(100%)';
    }
  
    // Finally, adjust the chatbox's height according to the available viewport space.
    adjustChatboxHeight();
  
  }
  

// Manual HORIZONTAL Resizing of the Chatbox
function resizerDown(e) {
    // Trigger the resizing logic only if we're not on a mobile device
    if (!isMobile) {
      // Set a flag to indicate that resizing has started
      isResizing = true;
      // Add a visual indicator (active state) to the resizer
      resizer.classList.add('resizer-active');
  
      /* Disconnect the ResizeObserver (if present) to avoid conflicting size adjustments
      if (chatboxResizeObserver) {
        chatboxResizeObserver.disconnect();
      }*/
  
      // Capture the initial horizontal coordinate, based on whether it's a mouse or touch event
      if (e.type === 'mousedown') {
        lastDownX = e.clientX;
      } else if (e.type === 'touchstart') {
        lastDownX = e.touches[0].clientX;
      }
  
      // Change the cursor to indicate horizontal resizing in progress
      document.body.style.cursor = 'ew-resize';
      // Prevent any default actions that might interfere with resizing
      e.preventDefault();
    }
  }
  
  function documentMove(e) {
    // If we're not currently resizing, exit
    if (!isResizing) return;
  
    // Determine the x-coordinate from the mouse or touch event
    let clientX;
    if (e.type === 'mousemove') {
      clientX = e.clientX;
    } else if (e.type === 'touchmove') {
      clientX = e.touches[0].clientX;
    }
  
    // Calculate the new chatbox width from the right side of the screen
    let offsetRight = document.body.clientWidth - clientX;
    let minChatboxWidth = 300;
    let maxChatboxWidth = 800;
    // Ensure the width is within defined min/max boundaries
    let newChatboxWidth = Math.min(Math.max(offsetRight, minChatboxWidth), maxChatboxWidth);
  
    // Apply the new width to the chatbox
    chatbox.style.width = newChatboxWidth + 'px';
  
    // Adjust the main content dimensions based on the new chatbox width
    let mainContentWidth = document.body.clientWidth - newChatboxWidth;
    mainContent.style.width = mainContentWidth + 'px';
    mainContent.style.marginRight = newChatboxWidth + 'px';
    mainContent.style.marginLeft = '0';
  
    // Adjust the bottomFlexBox dimensions similarly
    bottomFlexBox.style.width = mainContentWidth + 'px';
    bottomFlexBox.style.marginRight = newChatboxWidth + 'px';
  
    // Prevent any default actions that might interrupt the resizing
    e.preventDefault();
  }
  
  function documentUp(e) {
    // This function is triggered when the mouse or touch is released (e.g., mouseup, touchend)
    if (isResizing) {
      // Stop the resizing process
      isResizing = false;
      // Restore the default cursor
      document.body.style.cursor = '';
      // Remove the active styling on the resizer
      resizer.classList.remove('resizer-active');
  
      // Get the current width of the chatbox
      let chatboxWidth = chatbox.offsetWidth;
      // Save this width to localStorage so it can be applied in future sessions
      localStorage.setItem('chatboxWidth', chatboxWidth);
  
      /* Reconnect the ResizeObserver so it continues to observe changes automatically
      if (chatboxResizeObserver) {
        const chatboxElement = document.getElementById('chatbox');
        if (chatboxElement) {
          chatboxResizeObserver.observe(chatboxElement);
        }
      }*/
    }
  }
  
  // Attach event listeners for resizing
  resizer.addEventListener('mousedown', resizerDown);                  // Start resizing on mouse down
  resizer.addEventListener('touchstart', resizerDown);                 // Start resizing on touch start
  document.addEventListener('mousemove', documentMove);                // Handle mouse movement
  document.addEventListener('touchmove', documentMove, { passive: false }); // Handle touch movement (non-passive)
  document.addEventListener('mouseup', documentUp);                    // End resizing on mouse up
  document.addEventListener('touchend', documentUp);                   // End resizing on touch end
  document.addEventListener('touchcancel', documentUp);                // End resizing if touch is canceled
  


// Initialize ZingTouch on the chatbox element
const chatboxElement = document.getElementById('chatbox');

if (chatboxElement) {
    // Create a ZingTouch region for the chatbox with preventDefault set to false
    const ztRegion = new ZingTouch.Region(chatboxElement, true, false);

    // Cache the close button element
    const closeButton = chatboxElement.querySelector('.close-icon');

    // Adjust sensitivity options
    const swipeOptions = {
        maxRestTime: 80,    // Decrease to make swipe more sensitive to quick swipes
        moveThreshold: 5,   // Decrease to detect shorter swipes
        numInputs: 1         // Single-finger swipe
    };

    // Bind a swipe gesture to the chatbox element with adjusted sensitivity
    ztRegion.bind(chatboxElement, 'swipe', function(event) {
        // Check if the gesture started on the close button
        if (event.target === closeButton || closeButton.contains(event.target)) {
            // Do not handle swipe if it started on the close button
            return;
        }

        const currentGesture = event.detail.data[0];

        // Get the direction of the swipe
        let swipeAngle = currentGesture.currentDirection;

        // Normalize the angle to be between 0 and 360
        swipeAngle = (swipeAngle + 360) % 360;

        // Detect swipe right (angle between 315 degrees and 45 degrees)
        if (swipeAngle <= 45 || swipeAngle >= 315) {
            console.log('Swipe right detected', event);
            closeChatbox();
        }
    }, swipeOptions);
} else {
    console.error('Chatbox element not found for gesture initialization.');
}


// CLOSE CHATBOT click handler
$(".close-icon").on("click", function(event) {
    event.stopPropagation();
    closeChatbox();
});
function closeChatbox() {

     /* --- NEW: be sure the page can scroll again --- */
  document.documentElement.classList.remove('mobile-tablet-lock-scroll');
  document.body.classList.remove('mobile-tablet-lock-scroll');
  document.documentElement.style.overflow = '';
  document.body.style.overflow  = '';
    let pageNumElement = null;
    
    // --------------------
    // 1) Capture pageNumElement (if conditions are met)
    // --------------------
    if (isDesktop && readingModeActivated) {
        pageNumElement = getClosestPageNumElementFromBottom();
    } else if (isIOS && readingModeActivated) {
        pageNumElement = getClosestPageNumElementFromBottom();
    }
    
    // --------------------
    // 2) Close Chatbox UI
    // --------------------
    $("#chatbox").removeClass("open");
    toggleOlierButton();
    
    // Reset flags
    isFirstMessageAfterOliClick = false;
    hasImageButtonBeenClicked = false;
    oliMetadata = {
        author: '',
        chapterTitle: '',
        bookTitle: ''
    };
    
    // Adjust chatbox styles
    adjustChatboxStyle();
    
    // --------------------
    // 3) Handle Scrolling
    // --------------------
    // If desktop or iOS, we may do custom scrolling. Otherwise, do nothing.
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
        // DESKTOP
        if (isDesktop) {
            if (readingModeActivated && pageNumElement) {
            pageNumElement.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
            // If readingMode not active on Desktop, we do nothing.
        }
        // iOS
        else if (isIOS) {
            if (readingModeActivated && pageNumElement) {
            pageNumElement.scrollIntoView({ behavior: 'instant', block: 'center' });
            } else if (!readingModeActivated) {
            // If readingMode not active on iOS, scroll body down by 20px
            window.scrollBy(0, -100);
            }
        }
        // Other platforms: no special scrolling
        });
    });
    }
    

function getClosestPageNumElementFromBottom() {
    // Get all page number elements with the new class name
    var pageNumElements = document.querySelectorAll('p.p-num');

    var closestElement = null;
    var minDistanceFromBottom = Infinity;

    // Get the viewport height
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    // Loop through elements to find the one closest to the bottom of the viewport
    pageNumElements.forEach(function(element) {
        var rect = element.getBoundingClientRect();
        var distanceFromBottom = viewportHeight - rect.bottom;

        if (rect.bottom <= viewportHeight + 1 && distanceFromBottom >= 0) {
            if (distanceFromBottom < minDistanceFromBottom) {
                minDistanceFromBottom = distanceFromBottom;
                closestElement = element;
            }
        }
    });

    return closestElement;
}

function openChatboxSimplified() {
    // Open the chatbox
    $("#chatbox").addClass("open");
    toggleOlierButton();

    // Show necessary buttons
    $("#send-btn").show();
    $("#img-btn").hide();

    // Adjust chatbox styles
    adjustChatboxStyle();

    // Wait for the next frame to ensure layout is stable, then call autoResize
    requestAnimationFrame(() => {
        autoResize();
    });
}


function openChatboxAndAdjustScroll() {
    // 1) Capture the closest page number element from the bottom
    var pageNumElement = getClosestPageNumElementFromBottom();

    // 2) Open the chatbox
    $("#chatbox").addClass("open");
    toggleOlierButton();

    // 3) Show necessary buttons
    $("#send-btn").show();
    $("#img-btn").hide();

    // 4) Get chat input reference
    const chatInput = document.getElementById("chat-input");

    // 5) If desktop, focus and set selection
    if (isDesktop) {
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    }

    // 6) Always auto-resize (all platforms)
    requestAnimationFrame(() => {
        autoResize();
    });



    // Adjust chatbox styles
    adjustChatboxStyle();

    // After DOM has reflowed, scroll back to the captured element
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            if (pageNumElement) {
                pageNumElement.scrollIntoView({ behavior: 'instant', block: 'center' });
            } else {
                console.warn('No page number element found before opening chatbox.');
            }
        });
    });
}

// Open chatbot click handler
$(".open_chatbot").on("click", function(event) {
    event.stopPropagation(); // Prevent the event from reaching the document click handler

    if (isMobile) {
        // Use the simplified function for mobile devices
        openChatboxSimplified();
    } else {
        // Use the original function for non-mobile devices
        openChatboxAndAdjustScroll();
    }
});

// Initialize auto-scroll flag
let autoScrollEnabled = true;
const messagesContainer = document.getElementById('messages');

// Helper function to check if user is at the bottom
function checkIfAtBottom() {
    const threshold = 100; // Adjust as needed
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= threshold;
}

// Scroll event listener to update auto-scroll flag and button visibility
messagesContainer.addEventListener('scroll', function() {
    const isCurrentlyAtBottom = checkIfAtBottom();

    if (isCurrentlyAtBottom) {
        autoScrollEnabled = true;
         // Hide scroll-to-bottom button when at bottom
        if (scrollButton) scrollButton.style.display = 'none';
    } else {
        // User has scrolled up, disable auto-scroll
        autoScrollEnabled = false;
         // Show scroll-to-bottom button if overflowing and not at bottom
         if (isOverflowing() && scrollButton) {
            // Use flex if that's how you center the icon, otherwise 'block'
            scrollButton.style.display = 'flex'; // Or 'block'
         }
    }
});

// Immediate interaction handlers to disable auto-scroll
['mousedown', 'touchstart', 'wheel'].forEach(eventType => {
    messagesContainer.addEventListener(eventType, function() {
        // Directly disable auto-scroll on any interaction start
        autoScrollEnabled = false;
        // Update button visibility *immediately* based on new state
        updateScrollButtonVisibility();
    });
});
// Modify scrollToBottom function
function scrollToBottom() {
    if (autoScrollEnabled) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Automatically scroll to the bottom as new messages are added
const observer = new MutationObserver((mutationsList) => {
    // Only auto‑scroll if an AI message (.box.ai-message) was just added and never on a reference‑link click
    const addedAiMessage = mutationsList.some(mutation =>
      Array.from(mutation.addedNodes).some(node =>
        node.nodeType === Node.ELEMENT_NODE &&
        node.classList.contains('box') &&
        node.classList.contains('ai-message')
      )
    );
    if (addedAiMessage) {
      scrollToBottom();
    }
  });
  observer.observe(messagesContainer, { childList: true, subtree: true, characterData: true,  });



// Define the autoResize function
function autoResize() {
    const chatInput = document.getElementById('chat-input');
    const lineHeight = parseInt(window.getComputedStyle(chatInput).lineHeight) || 20; // Fetch the line-height from CSS or default to 20
    const maxHeight = 120;
    const minHeight = 40;

    // Reset the height to allow shrinking when deleting text
    chatInput.style.height = 'auto';

    // Calculate the number of lines (accounting for wrapping)
    const lines = Math.ceil(chatInput.scrollHeight / lineHeight);

    // Calculate new height
    let newHeight = Math.max(minHeight, Math.min(chatInput.scrollHeight, maxHeight));

    // Apply new height
    chatInput.style.height = newHeight + 'px';
}

// const chatInput = document.getElementById('chat-input');

// Attach the autoResize function to the input event
chatInput.addEventListener('input', autoResize);

// Initialize the height
autoResize();



// Define the scroll-to-bottom button and messages container
const messagesDiv = document.getElementById('messages');
const scrollButton = document.getElementById('scroll-to-bottom-btn');

// Function to check if the user is at the bottom
function isAtBottom() {
    const threshold = 10; // Adjust as needed
    return (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) <= threshold;
}

// Function to check if the messages container is overflowing
function isOverflowing() {
    return messagesDiv.scrollHeight > messagesDiv.clientHeight;
}

// Function to update the scroll button visibility
function updateScrollButtonVisibility() {
    if (isOverflowing() && !isAtBottom()) {
        scrollButton.style.display = 'block';
    } else {
        scrollButton.style.display = 'none';
    }
}

// Handle scroll-to-bottom button click
scrollButton.addEventListener('click', function() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Update visibility when the user scrolls
messagesDiv.addEventListener('scroll', function() {
    requestAnimationFrame(updateScrollButtonVisibility);
});


function populateChatHistory() {
    const savedChats = JSON.parse(localStorage.getItem('savedChats')) || [];
    const chatHistoryDropdown = document.getElementById('chat-history-dropdown');
    chatHistoryDropdown.innerHTML = ''; // Clear previous items

    // Add "Saved Conversations" header
    const header = document.createElement('div');
    header.classList.add('dropdown-header');
    header.innerText = 'Saved Conversations';
    chatHistoryDropdown.appendChild(header);

    if (savedChats.length === 0) {
        const noChatsMessage = document.createElement('div');
        noChatsMessage.classList.add('no-chats');
        noChatsMessage.innerText = 'No chats saved.';
        chatHistoryDropdown.appendChild(noChatsMessage);
        return;
    }

    savedChats.forEach((chat, index) => {
        const item = document.createElement('div');
        item.classList.add('dropdown-item');

        // Chat Title
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');
        titleSpan.innerText = chat.title || `Chat ${index + 1}`;

        // Buttons Container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('buttons-container');

        // Trash Can Icon
        const deleteIcon = document.createElement('span');
        deleteIcon.classList.add('delete-chat');
        deleteIcon.innerText = '🗑️'; // Trash can emoji

        // Add event listener to load chat on clicking the title
        titleSpan.addEventListener('click', function(event) {
            event.stopPropagation();
            loadChatHistory(index);
            chatHistoryDropdown.classList.remove('active');
        });

        // Add event listener to delete chat on clicking the trash can
        deleteIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            deleteChat(index);
        });

        // Only create and append the download icon if we're on a desktop browser
        if (isDesktop) {
            const downloadIcon = document.createElement('span');
            downloadIcon.classList.add('download-chat', 'fas', 'fa-download');
            downloadIcon.addEventListener('click', function(event) {
                event.stopPropagation();
                downloadChat(index);
            });

            buttonsContainer.appendChild(downloadIcon);
        }

        buttonsContainer.appendChild(deleteIcon);
        item.appendChild(titleSpan);
        item.appendChild(buttonsContainer);
        chatHistoryDropdown.appendChild(item);
    });
}


async function downloadChat(index) {
 
    const savedChats = JSON.parse(localStorage.getItem('savedChats')) || [];
    const chat = savedChats[index];

    if (!chat) {
        alert('Chat not found.');
        return;
    }

    // **Generate a Unique Filename**
    // Use the chat's first user message or a default title
    let chatTitle = 'Chat';
    for (const message of chat.messages) {
        if (message.role === 'user') {
            chatTitle = message.content.substring(0, 20); // Get first 20 characters
            break;
        }
    }

    // Sanitize the chat title to remove invalid filename characters
    chatTitle = chatTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

   // Get the current timestamp in local time
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');

// Format the timestamp as 'YYYY-MM-DD_HH-MM-SS'
const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

    // Define the file extension based on the capPlatform
    const fileExtension = (capPlatform === 'web') ? '.doc' : '.html';

    // Construct the unique filename
    const fileName = `${chatTitle}_${timestamp}${fileExtension}`;

    // Start building the HTML content
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${chatTitle}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
            }
            .sender {
                font-weight: bold;
                margin-top: 20px;
            }
            .message {
                margin-bottom: 10px;
                white-space: pre-wrap; /* Preserve line breaks */
            }
        </style>
    </head>
    <body>
    `;

    // Loop through the chat messages and append them to the HTML content
    chat.messages.forEach(message => {
        // Determine the sender
        const sender = message.role === 'assistant' ? 'Olier' : 'You';

        // Append sender
        htmlContent += `
            <p class="sender">${sender}</p>
        `;

        if (message.role === 'assistant') {
            // Include assistant's messages without escaping to preserve formatting
            htmlContent += `
                <div class="message">${message.content}</div>
            `;
        } else {
            // Escape user content to prevent XSS
            const userContent = message.content.replace(/[&<>"']/g, function(m) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[m];
            });
            htmlContent += `
                <p class="message">${userContent}</p>
            `;
        }
    });

    // Close the HTML tags
    htmlContent += `
    </body>
    </html>
    `;

    if (isWeb) {
        // **Web capPlatform Logic**
        // Create a blob from the HTML content and set MIME type accordingly
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; // Save with the unique filename
        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Chat saved successfully as ${fileName}.`);

    } else {
        // **Mobile capPlatform Logic**
        try {
            // Access Capacitor Plugins inside the mobile logic
            const { Filesystem } = Capacitor.Plugins;
    
            // Check and request permissions (only necessary on Android)
            if (capPlatform === 'android') {
                let permission = await Filesystem.checkPermissions();
                if (permission.publicStorage !== 'granted') {
                    permission = await Filesystem.requestPermissions();
                    if (permission.publicStorage !== 'granted') {
                        alert('Permission to access storage was denied.');
                        return;
                    }
                }
            }
    
            // Write the file to the device's filesystem
            await Filesystem.writeFile({
                path: fileName, // Save as .html file on mobile
                data: htmlContent,
                directory: 'DOCUMENTS', // Use string literal to specify the directory
                encoding: 'utf8',
                recursive: true
            });
    
            // Obtain the URI of the saved file
            const uriResult = await Filesystem.getUri({
                path: fileName,
                directory: 'DOCUMENTS'
            });
    
            alert(`Chat saved successfully as ${fileName} in Documents.`);
    
        } catch (error) {
            console.error('Unable to write file', error);
            alert('Failed to save chat.');
        }
    }
}

function deleteChat(index) {
    let savedChats = JSON.parse(localStorage.getItem('savedChats')) || [];

    // Remove the selected chat
    savedChats.splice(index, 1);

    // Save back to localStorage
    localStorage.setItem('savedChats', JSON.stringify(savedChats));

    // Refresh the dropdown
    populateChatHistory();
}

// Toggle chat history dropdown when the "Olier" button is clicked
document.getElementById('chat-history-btn').addEventListener('click', function(event) {
    event.stopPropagation();
    const chatHistoryDropdown = document.getElementById('chat-history-dropdown');
    const isActive = chatHistoryDropdown.classList.contains('active');
    if (isActive) {
        chatHistoryDropdown.classList.remove('active');
    } else {
        // Populate chat history when dropdown is opened
        populateChatHistory();
        chatHistoryDropdown.classList.add('active');
    }
});

function loadChatHistory(index) {
    const savedChats = JSON.parse(localStorage.getItem('savedChats')) || [];
    const selectedChat = savedChats[index];

    if (selectedChat) {
        const messagesBox = document.querySelector("#messages .messages-box");
        messagesBox.innerHTML = ''; // Clear existing messages
// **** ADD THIS LINE ****
$('#info-message').addClass('hidden');
// **********************

        selectedChat.messages.forEach(msg => {
            const messageBox = document.createElement("div");
            messageBox.classList.add("box");
            messageBox.classList.add(msg.role === "user" ? "right" : "ai-message");

            const message = document.createElement("div");
            message.classList.add("messages");
            message.style.whiteSpace = "pre-wrap";

            if (msg.role === "assistant") {
                // Sanitize and set the innerHTML for assistant messages
                let cleanHtml = DOMPurify.sanitize(msg.content);
                message.innerHTML = cleanHtml;
            } else {
                // Set textContent for user messages
                message.textContent = msg.content;
            }

            messageBox.appendChild(message);
            messagesBox.appendChild(messageBox);
        });

        document.querySelector("#messages .empty-div").style.display = "none";

        // Scroll to bottom after loading messages
        const messagesContainer = document.getElementById('messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}


// Function to save the current chat
function saveCurrentChat(showAlert = true) {
    const existingChats = JSON.parse(localStorage.getItem('savedChats')) || [];

    // Extract messages from the DOM
    const messages = [...document.querySelectorAll("#messages .box")].map(el => {
        const messageElement = el.querySelector('.messages');

        if (messageElement) {
            const role = el.classList.contains("right") ? "user" : "assistant";
            let content;

            if (role === "assistant") {
                // Save the rendered HTML content
                content = messageElement.innerHTML.trim();
            } else {
                content = messageElement.textContent.trim();
            }

            return { role: role, content: content };
        } else {
            console.warn("Warning: .messages element not found inside .box. Ignoring this element.");
            return null;
        }
    }).filter(Boolean); // Filter out any null values

    if (messages.length > 0) {
        // Get the first user's message
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        let chatTitle = 'Chat ' + (existingChats.length + 1);

        if (firstUserMessage) {
            const words = firstUserMessage.content.split(/\s+/).slice(0, 7);
            chatTitle = words.join(' ');
            if (words.length === 7) {
                chatTitle += '...';
            }
        }

        const newChat = {
            title: chatTitle,
            messages: messages
        };

        try {
            // Attempt to save the new chat
            existingChats.unshift(newChat); // Add new chat to the beginning
            localStorage.setItem('savedChats', JSON.stringify(existingChats));

            if (showAlert) {
                alert('Chat saved successfully.');
            }

            // **Clear the chat messages from the DOM**
            const messagesBox = document.querySelector("#messages .messages-box");
            messagesBox.innerHTML = ''; // Clear existing messages
// **** ADD THIS LINE ****
$('#info-message').removeClass('hidden');
// **********************

            // **Show the empty chat indicator**
            const emptyDiv = document.querySelector("#messages .empty-div");
            emptyDiv.style.display = "flex";
 // **** ADD THIS LINE AGAIN (for certainty) ****
 $('#info-message').removeClass('hidden');
 // *********************************************

            // **Optionally, clear the chat input field**
            document.getElementById('chat-input').value = '';

            // **Optionally, reset any conversation context variables**
            // conversationTokens = 0;
            // conversationContext = [];

        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                alert('Cannot save chat: Storage limit exceeded.');
                existingChats.shift(); // Remove the chat we just added
            } else {
                console.error('Error saving chat:', e);
                alert('An error occurred while saving the chat.');
            }
        }
    } else {
        if (showAlert) {
            alert('No chat messages to save.');
        }
    }
}

/* ===============================================
   AI-STYLE  (Plain | Poetic)  – No Radiobuttons
==================================================*/

const plainCard  = document.getElementById('plain-olier-card');
const poeticCard = document.getElementById('poetic-olier-card');
const hiddenStyleInput = document.getElementById('selectedStyle');

// ① Restore the saved style or default to ‘poetic’
let savedStyle = localStorage.getItem('olierStyle') || 'poetic';
hiddenStyleInput.value = savedStyle;
updateCardHighlight(savedStyle);

// ② Click handlers – toggle highlight + save to localStorage
plainCard .addEventListener('click', () => setStyle('plain'));
poeticCard.addEventListener('click', () => setStyle('poetic'));

function setStyle(style) {
    hiddenStyleInput.value = style;
    localStorage.setItem('olierStyle', style);
    updateCardHighlight(style);
}

function updateCardHighlight(style) {
    plainCard .classList.toggle('selected-card', style === 'plain');
    poeticCard.classList.toggle('selected-card', style === 'poetic');
}

// Attach event listener to the "Save" button
document.getElementById('save-chat-btn').addEventListener('click', function(event) {
    event.stopPropagation();
    saveCurrentChat();
});


// Hide the dropdown when clicking outside
document.addEventListener('click', function(event) {
    const chatHistoryDropdown = document.getElementById('chat-history-dropdown');
    if (chatHistoryDropdown.classList.contains('active')) {
        chatHistoryDropdown.classList.remove('active');
    }
});

/* ─────────────────────────────────────────────
   SEEK-SCOPE selector  (All | Aurobindo | Mother)
   Mirrors the Plain/Poetic pattern 1-for-1
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   SEEK-SCOPE selector  (All | Aurobindo | Mother)
   Mirrors the Plain/Poetic pattern 1-for-1
───────────────────────────────────────────── */

const scopeAllCard       = document.getElementById('scope-all-card');
const scopeAurobindoCard = document.getElementById('scope-aurobindo-card');
const scopeMotherCard    = document.getElementById('scope-mother-card');
const hiddenScopeInput   = document.getElementById('selectedScope');   // same as Style

// ❶  Helper → update UI, hidden input, localStorage
function setScope(scope, card) {
    [scopeAllCard, scopeAurobindoCard, scopeMotherCard]
        .forEach(c => c.classList.remove('selected-card'));

    card.classList.add('selected-card');          // gold outline
    hiddenScopeInput.value = scope;               // keep form state
    localStorage.setItem('seekScope', scope);     // persist
}

// ❷  Restore last choice (or default to all)
const savedScope = localStorage.getItem('seekScope') || 'all';
switch (savedScope) {
    case 'aurobindo': setScope('aurobindo', scopeAurobindoCard); break;
    case 'mother':    setScope('mother',    scopeMotherCard   ); break;
    default:          setScope('all',       scopeAllCard      );
}

// ❸  Wire clicks
scopeAllCard      .addEventListener('click', () => setScope('all',       scopeAllCard      ));
scopeAurobindoCard.addEventListener('click', () => setScope('aurobindo', scopeAurobindoCard));
scopeMotherCard   .addEventListener('click', () => setScope('mother',    scopeMotherCard   ));





// Prevent clicks inside the dropdown from closing it
document.getElementById('chat-history-dropdown').addEventListener('click', function(event) {
    event.stopPropagation();
});
/* Retrieve saved style from localStorage */
/*let savedStyle = localStorage.getItem('olierStyle');
console.log("Retrieved savedStyle:", savedStyle);

if (savedStyle && savedStyle !== 'poetic') {
    console.log("Found a saved style different from 'poetic':", savedStyle);
    const styleRadio = document.querySelector(`input[name='style'][value='${savedStyle}']`);
    console.log("Query for input[name='style'][value='" + savedStyle + "'] found:", styleRadio);
    if (styleRadio) {
        styleRadio.checked = true;
        console.log("Set", savedStyle, "style as checked.");
    } else {
        console.warn("No matching radio found for", savedStyle, ". Falling back to poetic.");
        localStorage.setItem('olierStyle', 'poetic');
        const poeticRadio = document.querySelector(`input[name='style'][value='poetic']`);
        if (poeticRadio) {
            poeticRadio.checked = true;
        } else {
            console.error("No poetic radio found, check HTML.");
        }
    }
} else if (!savedStyle) {
    console.log("No saved style found, defaulting to poetic.");
    localStorage.setItem('olierStyle', 'poetic');
    const poeticRadio = document.querySelector(`input[name='style'][value='poetic']`);
    if (poeticRadio) {
        poeticRadio.checked = true;
        console.log("Set poetic as checked by default.");
    } else {
        console.error("No poetic radio found, check HTML.");
    }
} else {
    // savedStyle is 'poetic'
    console.log("Saved style is 'poetic'. Setting poetic radio checked.");
    const poeticRadio = document.querySelector(`input[name='style'][value='poetic']`);
    if (poeticRadio) {
        poeticRadio.checked = true;
    } else {
        console.error("No poetic radio found, check HTML.");
    }
}*/

/* Retrieve saved reflectiveMode from localStorage */
/* Retrieve saved speedyMode from localStorage */
let savedSpeedyMode = localStorage.getItem('speedyMode'); // <-- Changed key
console.log("Retrieved savedSpeedyMode:", savedSpeedyMode);

const speedyCheckbox = document.querySelector("input[name='speedy-mode']"); // <-- Changed selector
if (speedyCheckbox) { // <-- Changed variable name
    // If savedSpeedyMode === 'true', check the box
    speedyCheckbox.checked = (savedSpeedyMode === 'true'); // <-- Changed variables

    // Set up event listener to update localStorage when Speedy Mode is changed
    speedyCheckbox.addEventListener('change', (e) => { // <-- Changed variable name
        localStorage.setItem('speedyMode', e.target.checked); // <-- Changed key
        console.log("Speedy Mode changed to:", e.target.checked); // <-- Changed log message
    });
} else {
    // Updated warning message for clarity
    console.warn("No 'speedy-mode' checkbox found in the HTML. Check the markup.");
}

/* Set up event listeners to update localStorage on style change */
/*const styleRadios = document.querySelectorAll("input[name='style']");
console.log("Found style radios:", styleRadios);
styleRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        console.log("User changed style to:", e.target.value);
        localStorage.setItem('olierStyle', e.target.value);
        console.log("LocalStorage now (olierStyle):", localStorage.getItem('olierStyle'));
    });
});*/




// ===============================================
// DYNAMIC CHATBOT FUNCTIONS - SEND MESSAGE AND IMAGE GEN
// ===============================================

// Assume these functions/variables are defined elsewhere:
// $, adjustChatboxHeight, updateScrollButtonVisibility, chatInput,
// isFirstMessageAfterOliClick, serverUrl, markdownit, DOMPurify,
// removeAllCopyButtons, isIOS, autoResize, scrollToBottom,
// addCopyButton, displayDomainOnlyCardLinks

$('#send-btn').on('click', sendMessage);

$('#chat-input').on('keypress', function(e) {
    if (e.which === 13) { // 13 is the Enter key code
        e.preventDefault(); // Prevent default Enter key behavior
        sendMessage();
    }
});

async function sendMessage() {
    let input_message = $('#chat-input').val();
    if (input_message.trim() === '') {
        alert('Please enter a message');
        return;
    }

 // **** ADD THIS LINE ****
 $('#info-message').addClass('hidden');
 // **********************


    document.querySelector("#messages .empty-div").style.display = "none";

    // --- User message display ---
    const messageBox = document.createElement("div");
    messageBox.classList.add("box", "right");
    const message = document.createElement("div");
    message.classList.add("messages");
    message.textContent = input_message;
    messageBox.appendChild(message);
    document.querySelector("#messages .messages-box").appendChild(messageBox);

    // --- UI Adjustments & Scroll (User Message) ---
        requestAnimationFrame(() => { // Ensure DOM update before scrolling
            // ***** ADD THIS LINE *****
        autoScrollEnabled = true; // FORCE scroll down for this user message
        // *************************
        scrollToBottom();
        if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
        if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
    });
    // --- END UI Adjustments (User Message) ---

    // --- Input clearing and focus ---
    $('#chat-input').val('');
    if (typeof autoResize === 'function') autoResize(); // Resize input after clearing

    // --- MODIFICATION START ---
    // Only refocus the input field if it's NOT an iOS device
    // if (!isIOS) { // Assuming 'isIOS' is your globally defined boolean flag
    //     $('#chat-input').focus();
    // }
    // --- MODIFICATION END ---

    // --- History setup ---
    const allMessages = [...document.querySelectorAll("#messages .box")].map(el => {
        const messageElement = el.querySelector('.messages');
        if (messageElement) {
            const role = el.classList.contains("right") ? "user" : "assistant";
            let content = '';

            if (role === "assistant") {
                // Clone the message element to avoid modifying the actual display
                const clonedElement = messageElement.cloneNode(true);
                // Find and remove the grounding links container *from the clone*
                const linksContainer = clonedElement.querySelector('.grounding-links-container');
                if (linksContainer) {
                    linksContainer.remove();
                }
                // Get text content *from the modified clone*
                content = clonedElement.textContent.trim();
            } else {
                // For user messages, just get the text content directly
                content = messageElement.textContent.trim();
            }

            // Ensure content is not empty before adding
            if (content) {
               return { role, content };
            }
        }
        return null;
    }).filter(Boolean); // Keep filtering nulls

    // Keep only the last 4 valid messages for history
    let chatHistory = allMessages.slice(-4);
    console.log("Prepared Chat History:", JSON.stringify(chatHistory, null, 2)); // Add logging to verify
// ---
    // --- Style and Mode setup ---
    //const selectedStyle = document.querySelector("input[name='style']:checked").value;
    const speedyCheckbox = document.querySelector("input[name='speedy-mode']"); // <-- Find the NEW checkbox
    const isSpeedyMode = speedyCheckbox ? speedyCheckbox.checked : false; // <-- Get its state, default false if not found
    
    const selectedStyle   = document.getElementById('selectedStyle')?.value || 'poetic';
    console.log(`Style: ${selectedStyle}, Speedy Mode Active: ${isSpeedyMode}`); // Log the values being sent

    // --- AI Response Container Setup ---
    let responseBox = document.createElement("div");
    responseBox.classList.add("box", "ai-message");
    let responseMessage = document.createElement("div");
    responseMessage.classList.add("messages"); // This is where the main text goes
    responseMessage.style.whiteSpace = "pre-wrap";
    let meditatingElement = document.createElement("div");
    meditatingElement.classList.add("loading-message");
    // meditatingElement.textContent = 'Meditating...'; // REMOVED - Set by new logic
    // --- ADD THE LINE HERE ---
    responseMessage.classList.add('is-loading'); // <-- ADD THIS LINE
    // --- BEFORE THIS LINE ---
    
    responseMessage.appendChild(meditatingElement);
    let messageWrapper = document.createElement("div"); // Used for copy button positioning
    messageWrapper.style.position = "relative";
    messageWrapper.appendChild(responseMessage);
    responseBox.appendChild(messageWrapper); // Add wrapper (containing message div) to the box
    document.querySelector("#messages .messages-box").appendChild(responseBox);
    if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
    if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();

    // --- Rotating Meditating Animation --- START ---
    const meditatingMessages = [
        'Meditating 🙏🏻', // Include emoji directly
        'Seeking light 🕯️',
        'Pondering the essence 🌱',
        'Unraveling the mystery 🔍',
        'Connecting thoughts 💭',
        'Concentrating 🧘‍♂️',
        'Finding the right words 🗣️',
        'Balancing the concepts ⚖️',
        'Searching for insights 🔎',
        'Almost there ⏳'

    ];
    let currentMessageIndex = 0;
    let dotCount = 0;
    let dotInterval = null; // Renamed from meditatingInterval
    let messageRotationInterval = null;

    // Function to update the text content (base message + dots)
    const updateMeditatingText = () => {
        if (meditatingElement && meditatingElement.parentNode) {
            const baseMessage = meditatingMessages[currentMessageIndex];
            meditatingElement.textContent = baseMessage + '.'.repeat(dotCount);
        }
    };

    // Set initial message
    updateMeditatingText();

    // Interval for animating the dots (every 500ms)
    dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 6;
        updateMeditatingText(); // Update text with new dot count
        // Check if element still exists (redundant check, good practice)
        if (!meditatingElement || !meditatingElement.parentNode) {
             clearInterval(dotInterval);
             if (messageRotationInterval) clearInterval(messageRotationInterval); // Clear other interval too
        }
    }, 500);

    // Interval for rotating the base message (every 3 seconds)
    messageRotationInterval = setInterval(() => {
        currentMessageIndex = (currentMessageIndex + 1) % meditatingMessages.length;
        // No need to call updateMeditatingText() here, dotInterval handles the visual update
        // We just need to update the index for the *next* dotInterval cycle.
        // However, to make the change immediate:
        updateMeditatingText(); // Update immediately with new message and current dots

        // Check if element still exists (redundant check, good practice)
        if (!meditatingElement || !meditatingElement.parentNode) {
             clearInterval(messageRotationInterval);
             if (dotInterval) clearInterval(dotInterval); // Clear other interval too
        }
    }, 6000); // 6 seconds

    // Helper function to clear both intervals
    const clearMeditatingIntervals = () => {
        if (dotInterval) clearInterval(dotInterval);
        if (messageRotationInterval) clearInterval(messageRotationInterval);
        dotInterval = null;
        messageRotationInterval = null;
    };
    // --- Rotating Meditating Animation --- END ---


    // --- Variables for grounding links ---
    let finalGroundingJsonString = null;
    const groundingMarker = "###GROUNDING_SOURCES_START###";
    let markerFound = false;
    // ---

    try {
        const response = await fetch(serverUrl + '/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({
                messages: chatHistory,
                style: selectedStyle,
                speedy_mode: isSpeedyMode // <-- Using snake_case for Python backend
            })
        });

        // --- Basic response check ---
        if (!response.ok) {
             clearMeditatingIntervals(); // Clear intervals on error
             if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
             throw new Error(`HTTP error! status: ${response.status}`);
         }
        // ---

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const md = window.markdownit();
        let accumulatedText = '';

                   // Streaming
                   while (true) {
                    const { done, value } = await reader.read();

                    // Stop meditating animation and remove element on first chunk
                    if (value && meditatingElement && meditatingElement.parentNode) {
                        clearMeditatingIntervals(); // Clear intervals
                        meditatingElement.remove();
                        meditatingElement = null; // Nullify to prevent further checks
                        responseMessage.classList.remove('is-loading'); // <-- ADD (Remove class here)
                        if (!markerFound) {
                            responseMessage.innerHTML = ''; // Clear placeholder space
                        }
                    }

                    if (value) {
                        let chunk = decoder.decode(value);

                        // Marker Detection Logic
                        const markerIndex = chunk.indexOf(groundingMarker);

                        let cleanHtml = ''; // Declare cleanHtml here

                        if (markerIndex !== -1) {
                            const textPart = chunk.substring(0, markerIndex);
                            if (!markerFound) {
                                accumulatedText += textPart;
                                // Render final text part before marker
                                let dirtyHtml = md.render(accumulatedText.replace(/<\/s>/g, ''));
                                cleanHtml = DOMPurify.sanitize(dirtyHtml); // Assign here
                                responseMessage.innerHTML = cleanHtml;
                            }
                            // Store the JSON part
                            finalGroundingJsonString = chunk.substring(markerIndex + groundingMarker.length).trimStart();
                            markerFound = true;

                        } else if (!markerFound) {
                            // Append chunk to main text and render progressively
                            accumulatedText += chunk;
                            let dirtyHtml = md.render(accumulatedText.replace(/<\/s>/g, ''));
                            cleanHtml = DOMPurify.sanitize(dirtyHtml); // Assign here
                            responseMessage.innerHTML = cleanHtml;
                        }
                        // If marker was found previously, finalGroundingJsonString will just keep accumulating
                        // We don't update innerHTML again in that case until 'done'

                        // *** ADDED: Ensure scrolling and layout adjustments happen on each update ***
                        if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                        if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                        scrollToBottom(); // <-- Explicitly scroll after content update
                        // *** END ADDED ***

                    }

                    // Done condition check
                    if (done) {
                        clearMeditatingIntervals(); // Ensure cleared on done
                        if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove(); // Final cleanup if needed

                        // Final rendering of accumulated text (only needed if marker was never found AND content changed)
                        if (!markerFound) {
                             // No need to re-render if it was already done in the loop
                        }


                        // --- Parse JSON and Display Links ---
                        let groundingSources = [];
                        console.log("Attempting to parse grounding JSON. String received:", finalGroundingJsonString);
                        if (finalGroundingJsonString) {
                            try {
                                groundingSources = JSON.parse(finalGroundingJsonString.trim());
                                console.log("Parsed Grounding Sources:", groundingSources);
                                displayDomainOnlyCardLinks(responseMessage, groundingSources); // Pass responseMessage div
                            } catch (e) {
                                console.error("Error parsing final grounding JSON:", e, "Data:", finalGroundingJsonString);
                            }
                        } else {
                            console.log("No grounding JSON string received (marker likely not found).");
                        }
                        // --- END ---

                        // Add Copy Button
                        addCopyButton(messageWrapper);

                        // *** MOVED UI Adjustments into the loop, but a final scroll is safe ***
                          scrollToBottom(); // Final scroll after everything is done
                        // *** END MOVED ***

                        break; // Exit loop
                    }
                } // End while loop

    } catch (error) {
        console.error('Error in sendMessage:', error);
        clearMeditatingIntervals(); // Clear intervals on catch
        if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
        responseMessage.classList.remove('is-loading'); // <-- ADD
        if (responseMessage) {
            responseMessage.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
        }
    }
    finally {
        // Ensure intervals are cleared in finally block as a safety net,
        // though they should be cleared earlier in most cases.
        clearMeditatingIntervals();

        if (typeof isFirstMessageAfterOliClick !== 'undefined' && isFirstMessageAfterOliClick) {
            isFirstMessageAfterOliClick = false;
        }
        // Assuming these buttons exist and are managed elsewhere
        // $("#img-btn").hide();
        // $("#send-btn").show();

        // Re-focus input if not iOS (already handled earlier, but safe to keep)
        // if (!isIOS) {
        //      $('#chat-input').focus();
        // }
    }
}

   // ===============================================
    // COPY BUTTON HELPER FUNCTIONS (SHARED)
    // These stay where they are, defined globally or in a shared scope.
    // DO NOT MOVE THESE INSIDE THE IMAGE BUTTON CLICK HANDLER.
    // ===============================================

// Function to add copy button (Adjusted to exclude card container)
function removeAllCopyButtons() {
    document.querySelectorAll('.copy-button').forEach(button => button.remove());
}

function addCopyButton(wrapper) {
    removeAllCopyButtons();
    let copyButton = document.createElement("button");
    copyButton.innerHTML = '<div class="copy-icon"></div>'; // Use CSS for the icon
    copyButton.classList.add("copy-button");
    copyButton.style.position = "absolute";
    copyButton.style.bottom = "5px";
    copyButton.style.right = "5px";
    copyButton.style.background = "none";
    copyButton.style.border = "none";
    copyButton.style.cursor = "pointer";
    copyButton.style.padding = "5px";

    copyButton.addEventListener("click", function() {
        const allMessages = document.querySelectorAll("#messages .box");
        const messageBox = wrapper.closest('.box.ai-message');
        if (!messageBox) return;

        const userMessageBox = messageBox.previousElementSibling;
        const messagesToCopy = [];
        if (userMessageBox && userMessageBox.classList.contains('right')) {
            messagesToCopy.push(userMessageBox);
        }
        messagesToCopy.push(messageBox);

        let textToCopyPlain = "";
        let textToCopyHTML = "";

        messagesToCopy.forEach((box) => {
            const messageElement = box.querySelector('.messages');
            if (messageElement) {
                const role = box.classList.contains("right") ? "User" : "Olier";
                const clonedElement = messageElement.cloneNode(true);
                const linksContainer = clonedElement.querySelector('.grounding-links-container');
                if (linksContainer) {
                    linksContainer.remove();
                }
                const contentPlain = clonedElement.textContent.trim();
                const contentHTML = clonedElement.innerHTML.trim();

                textToCopyPlain += `${role}: ${contentPlain}\n\n`;
                textToCopyHTML += `<p><strong>${role}:</strong></p>${contentHTML}<br>`;
            }
        });

        if (textToCopyPlain && textToCopyHTML) {
            const clipboardItem = new ClipboardItem({
                "text/plain": new Blob([textToCopyPlain], { type: "text/plain" }),
                "text/html": new Blob([textToCopyHTML], { type: "text/html" })
            });

            navigator.clipboard.write([clipboardItem]).then(() => {
                copyButton.innerHTML = '<div class="tick-icon">✓</div>';
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        } else {
            console.log("No messages found to copy.");
        }
    });
 // --- CHANGE THIS PART ---
    // Find the actual message bubble div INSIDE the wrapper
    const messageDiv = wrapper.querySelector('.messages'); 
    if (messageDiv) {
        messageDiv.appendChild(copyButton); // Append to the inner message bubble
    } else {
        // Fallback or error handling if needed, though unlikely
        wrapper.appendChild(copyButton); 
        console.warn("Could not find .messages div in wrapper, appending copy button to wrapper.");
    }
    // --- END CHANGE ---
}


// --- NEW: Function displayDomainOnlyCardLinks with Toggle ---
function displayDomainOnlyCardLinks(messageContentDiv, sources) {
    if (!Array.isArray(sources) || sources.length === 0) {
        console.log("No valid grounding sources to display.");
        return;
    }

    const existingContainer = messageContentDiv.querySelector('.grounding-links-container');
    if (existingContainer) {
        existingContainer.remove();
    }

    const linksOuterContainer = document.createElement('div');
    linksOuterContainer.classList.add('grounding-links-container');
    linksOuterContainer.style.marginTop = '15px';
    linksOuterContainer.style.paddingTop = '10px';
    linksOuterContainer.style.borderTop = '1px solid #eee';

    // --- Clickable title/toggle area ---
    const titleToggleArea = document.createElement('div');
    titleToggleArea.style.display = 'flex';
    titleToggleArea.style.alignItems = 'center';
    titleToggleArea.style.cursor = 'pointer';
    titleToggleArea.style.marginBottom = '8px';

    const titleElement = document.createElement('strong');
    titleElement.textContent = 'Sources';
    titleElement.style.fontSize = '0.9em';
    titleElement.style.marginRight = '5px';

    const toggleIcon = document.createElement('span');
    toggleIcon.classList.add('toggle-icon');
    toggleIcon.innerHTML = '&#9662;'; // Down arrow
    toggleIcon.style.fontSize = '0.8em';
    toggleIcon.style.transition = 'transform 0.2s ease';

    titleToggleArea.appendChild(titleElement);
    titleToggleArea.appendChild(toggleIcon);
    linksOuterContainer.appendChild(titleToggleArea);

    // --- Flex container for the cards (Initially Hidden) ---
    const cardsFlexContainer = document.createElement('div');
    cardsFlexContainer.classList.add('grounding-cards-flex-container');
    cardsFlexContainer.style.display = 'none'; // Hidden
    cardsFlexContainer.style.flexWrap = 'wrap';
    cardsFlexContainer.style.gap = '8px'; // Slightly smaller gap
    cardsFlexContainer.style.marginTop = '5px';

    // --- Add each source as a card ---
    sources.forEach((source, index) => {
        if (typeof source === 'object' && source !== null && source.uri) {
            const cardLink = document.createElement('a');
            cardLink.href = source.uri; // Link still uses redirect URL
            cardLink.target = '_blank';
            cardLink.rel = 'noopener noreferrer';
            cardLink.classList.add('grounding-source-card');

            // Card Styling
            cardLink.style.display = 'inline-block'; // Changed to inline-block for better wrapping
            cardLink.style.border = '1px solid #e0e0e0';
            cardLink.style.borderRadius = '12px'; // More rounded
            cardLink.style.padding = '6px 10px'; // Adjusted padding
            cardLink.style.textDecoration = 'none';
            cardLink.style.color = '#333'; // Darker text
            cardLink.style.backgroundColor = '#f9f9f9';
            cardLink.style.fontSize = '0.8em'; // Slightly smaller font
            cardLink.style.transition = 'background-color 0.2s ease, border-color 0.2s ease';
            cardLink.style.whiteSpace = 'nowrap'; // Prevent domain wrapping

            cardLink.onmouseover = () => { cardLink.style.backgroundColor = '#eee'; cardLink.style.borderColor = '#ccc'; };
            cardLink.onmouseout = () => { cardLink.style.backgroundColor = '#f9f9f9'; cardLink.style.borderColor = '#e0e0e0'; };

            // --- Determine and display Domain ONLY ---
            let displayDomain = 'Source'; // Default fallback
            // Prioritize source.title if it looks like a domain
            if (source.title && source.title.includes('.') && !source.title.includes(' ') && !source.title.includes('<')) {
                 displayDomain = source.title.replace(/^www\./, '');
            } else {
                 // Fallback: Try to parse the original redirect URI
                 try {
                     const url = new URL(source.uri);
                     // Heuristic: If hostname is vertex..., it's likely a fallback itself, prefer title if available
                     if (url.hostname.includes('vertexaisearch') && source.title && source.title.trim() !== '') {
                         displayDomain = source.title.trim(); // Use title if vertex URL detected
                     } else {
                         displayDomain = url.hostname.replace(/^www\./, '');
                     }
                 } catch (e) {
                    // Final fallback if parsing fails or title wasn't domain-like
                    displayDomain = (source.title && source.title.trim() !== '') ? source.title.trim() : `Source ${index + 1}`;
                 }
            }
            cardLink.textContent = displayDomain; // Set the visible domain text directly on the link
            // ---

            cardsFlexContainer.appendChild(cardLink);
        } else {
            console.warn("Skipping invalid source item:", source);
        }
    });

    // Append the flex container (initially hidden)
    linksOuterContainer.appendChild(cardsFlexContainer);

    // --- Add Toggle Functionality ---
titleToggleArea.addEventListener('click', () => {
    // ***** 1. Get the messages container and save current scroll position *****
    const messagesContainer = document.getElementById('messages');
    // const currentScrollTop = messagesContainer.scrollTop;
    // ***********************************************************************

    const isHidden = cardsFlexContainer.style.display === 'none';
    cardsFlexContainer.style.display = isHidden ? 'flex' : 'none'; // Toggle display
    toggleIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)'; // Rotate arrow

    // Let these functions run - adjustChatboxHeight WILL scroll to bottom here
    if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
    if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();

    // ***** 2. Immediately restore the saved scroll position *****
    // messagesContainer.scrollTop = currentScrollTop;
    // **********************************************************

    // Optional: You might call updateScrollButtonVisibility *again* after restoring
    // scroll position, just in case the restored position affects the button state.
    // if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
});
// ---
    // ---

    // Append the whole links section to the message content div only if cards were added
    if (cardsFlexContainer.hasChildNodes()) {
        messageContentDiv.appendChild(linksOuterContainer);
    } else {
        console.log("No valid links were generated from sources.");
    }
}
// --- END UPDATED ---




    // ===============================================
    // IMAGE GENERATION EVENT HANDLER
    // REPLACE YOUR ENTIRE EXISTING $('#img-btn').on('click', ...) BLOCK WITH THIS NEW ONE:
    // ===============================================
    $('#img-btn').on('click', async function() {
        $('#info-message').addClass('hidden');

        let input_message = $('#chat-input').val();

        if (input_message.trim() === '') {
            alert('Please enter a message');
            return;
        }

        const match = input_message.match(/"([^"]+)"$/);
        let extractedText = input_message;
        if (match && match[1]) {
            extractedText = match[1];
        }

        document.querySelector("#messages .empty-div").style.display = "none";

        const messageBox = document.createElement("div");
        messageBox.classList.add("box", "right");
        const message = document.createElement("div");
        message.classList.add("messages");
        message.textContent = input_message;
        messageBox.appendChild(message);
        document.querySelector("#messages .messages-box").appendChild(messageBox);

        autoScrollEnabled = true;
        requestAnimationFrame(() => {
            scrollToBottom(); // Assumes global scrollToBottom is defined
            adjustChatboxHeight(); // Assumes global adjustChatboxHeight is defined
            updateScrollButtonVisibility(); // Assumes global updateScrollButtonVisibility is defined
        });

        $('#chat-input').val('');
        // chatInput is assumed to be a globally/higher-scoped cached DOM element
        if (typeof chatInput !== 'undefined' && chatInput) {
             chatInput.dispatchEvent(new Event('input'));
        }


        // --- AI Response Container Setup for Description ---
        let descriptionResponseBox = document.createElement("div");
        descriptionResponseBox.classList.add("box", "ai-message");
        let descriptionResponseMessage = document.createElement("div");
        descriptionResponseMessage.classList.add("messages");
        descriptionResponseMessage.style.whiteSpace = "pre-wrap";
        let meditatingElement = document.createElement("div");
        meditatingElement.classList.add("loading-message");
        descriptionResponseMessage.classList.add('is-loading');

        descriptionResponseMessage.appendChild(meditatingElement);
        let descriptionMessageWrapper = document.createElement("div");
        descriptionMessageWrapper.style.position = "relative";
        descriptionMessageWrapper.appendChild(descriptionResponseMessage);
        descriptionResponseBox.appendChild(descriptionMessageWrapper);
        document.querySelector("#messages .messages-box").appendChild(descriptionResponseBox);

        requestAnimationFrame(() => {
            autoScrollEnabled = true;
            scrollToBottom();
            if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
            if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
        });

        // --- Rotating Meditating Animation --- START ---
        const meditatingMessages = [
            'Creating vision 🎨', 'Dreaming shapes ✨', 'Painting pixels 🖌️',
            'Imagining worlds 🌍', 'Visualizing thoughts 💡', 'Focusing energy 🌟',
            'Crafting art 🖼️', 'Almost ready... ⏳'
        ];
        let currentMessageIndex = 0;
        let dotCount = 0;
        let dotInterval = null;
        let messageRotationInterval = null;

        const updateMeditatingText = () => {
            if (meditatingElement && meditatingElement.parentNode) {
                const baseMessage = meditatingMessages[currentMessageIndex];
                meditatingElement.textContent = baseMessage + '.'.repeat(dotCount);
            }
        };
        updateMeditatingText();
        dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 6;
            updateMeditatingText();
            if (!meditatingElement || !meditatingElement.parentNode) {
                clearInterval(dotInterval);
                if (messageRotationInterval) clearInterval(messageRotationInterval);
            }
        }, 500);
        messageRotationInterval = setInterval(() => {
            currentMessageIndex = (currentMessageIndex + 1) % meditatingMessages.length;
            updateMeditatingText();
            if (!meditatingElement || !meditatingElement.parentNode) {
                clearInterval(messageRotationInterval);
                if (dotInterval) clearInterval(dotInterval);
            }
        }, 4000);
        const clearMeditatingIntervals = () => {
            if (dotInterval) clearInterval(dotInterval);
            if (messageRotationInterval) clearInterval(messageRotationInterval);
            dotInterval = null; messageRotationInterval = null;
        };
        // --- Rotating Meditating Animation --- END ---

        try {
            const response = await fetch(serverUrl + '/api/generate-description', { // serverUrl is global
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: extractedText })
            });

            if (!response.ok) {
                clearMeditatingIntervals();
                if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
                descriptionResponseMessage.classList.remove('is-loading');
                descriptionResponseMessage.innerHTML = `<span style="color: red;">Error generating description: ${response.statusText}</span>`;
                throw new Error(`HTTP error generating description! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let firstChunkReceived = false;
            let accumulatedText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (value) {
                    if (!firstChunkReceived) {
                        clearMeditatingIntervals();
                        if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
                        descriptionResponseMessage.classList.remove('is-loading');
                        descriptionResponseMessage.innerHTML = '';
                        firstChunkReceived = true;
                    }
                    let chunk = decoder.decode(value);
                    accumulatedText += chunk;
                    descriptionResponseMessage.innerHTML = accumulatedText;
                    requestAnimationFrame(() => {
                        autoScrollEnabled = true; scrollToBottom();
                        if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                        if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                    });
                }
                if (done) {
                    addCopyButton(descriptionMessageWrapper); // <<<< CALLS GLOBAL addCopyButton
                    break;
                }
            }

            let loadingBox = document.createElement("div");
            loadingBox.classList.add("box", "ai-message");
            let loadingMessage = document.createElement("div");
            loadingMessage.classList.add("messages", "loading-message");
            loadingMessage.textContent = "Conjuring visuals";
            loadingBox.appendChild(loadingMessage);
            document.querySelector("#messages .messages-box").appendChild(loadingBox);

            requestAnimationFrame(() => {
                autoScrollEnabled = true; scrollToBottom();
                if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
            });

            let imgGenDots = 0;
            const loadingInterval = setInterval(() => {
                imgGenDots = (imgGenDots + 1) % 4;
                loadingMessage.textContent = "Conjuring visuals" + ".".repeat(imgGenDots);
            }, 500);

            const imageResponse = await $.ajax({ // $ is global jQuery
                url: serverUrl + '/api/generate-flux-image',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ prompt: accumulatedText }),
                dataType: 'json'
            });

            clearInterval(loadingInterval);
            loadingBox.remove();

            requestAnimationFrame(() => {
                if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
            });

            let imageBox = document.createElement("div");
            imageBox.classList.add("box", "ai-message");
            let imageMessage = document.createElement("div");
            imageMessage.classList.add("messages");
            imageBox.appendChild(imageMessage);

            imageResponse.images.forEach(image => {
                let imageContainer = document.createElement("div");
                imageContainer.style.display = "inline-block";
                imageContainer.style.marginTop = "10px";
                imageContainer.style.position = "relative";

                const img = document.createElement("img");
                img.src = image.url;
                img.alt = "Generated Flux Artwork";
                img.style.maxWidth = "100%";
                img.style.display = "block";
                img.style.borderRadius = "8px";
                imageContainer.appendChild(img);

                img.onload = function() {
                    addSaveImageButton(imageContainer, image.url); // <<<< Calls the NESTED addSaveImageButton
                    requestAnimationFrame(() => {
                        autoScrollEnabled = true; scrollToBottom();
                        if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                        if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
                    });
                };
                img.onerror = function() {
                    console.error('Error loading image:', image.url);
                    imageContainer.innerHTML = `<span style="color:red; font-size:0.8em;">Error loading image.</span>`;
                };
                imageMessage.appendChild(imageContainer);
            });
            document.querySelector("#messages .messages-box").appendChild(imageBox);

            requestAnimationFrame(() => {
                autoScrollEnabled = true; scrollToBottom();
                if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
            });

             // isDesktop is assumed to be a globally defined variable
            if (typeof isDesktop !== 'undefined' && isDesktop) {
                const chatInputElement = document.getElementById("chat-input"); // Re-fetch or use cached
                if (chatInputElement) {
                    chatInputElement.focus();
                    chatInputElement.setSelectionRange(chatInputElement.value.length, chatInputElement.value.length);
                }
            }
            $("#img-btn").hide(); // $ is global jQuery
            $("#send-btn").show();

        } catch (error) {
            clearMeditatingIntervals();
            if (meditatingElement && meditatingElement.parentNode) meditatingElement.remove();
            if (descriptionResponseMessage && descriptionResponseMessage.classList.contains('is-loading')) {
                descriptionResponseMessage.classList.remove('is-loading');
                descriptionResponseMessage.innerHTML = `<span style="color: red;">An error occurred.</span>`;
            }
            const existingLoadingBox = document.querySelector(".messages-box .box .loading-message")?.closest('.box');
            if (existingLoadingBox) existingLoadingBox.remove();

            let errorMessageText = 'An error occurred while generating the image.';
            if (error.responseJSON && error.responseJSON.error) {
                errorMessageText = error.responseJSON.error;
            } else if (error.message) {
                errorMessageText = error.message;
            }
            const errorBox = document.createElement("div");
            errorBox.classList.add("box", "ai-message");
            const errorMessageDiv = document.createElement("div");
            errorMessageDiv.classList.add("messages");
            errorMessageDiv.innerHTML = `<span style="color: red;">${errorMessageText}</span>`;
            errorBox.appendChild(errorMessageDiv);
            document.querySelector("#messages .messages-box").appendChild(errorBox);

            requestAnimationFrame(() => {
                autoScrollEnabled = true; scrollToBottom();
                if (typeof adjustChatboxHeight === 'function') adjustChatboxHeight();
                if (typeof updateScrollButtonVisibility === 'function') updateScrollButtonVisibility();
            });

            document.getElementById("chat-input").value = "";
            $("#img-btn").hide();
            $("#send-btn").show();
        }

        // --- NESTED HELPER FUNCTION FOR THIS EVENT ONLY ---
        // This function is defined INSIDE the image button click handler
        // because it's only used here.
        function addSaveImageButton(container, imageUrl) {
            let saveButton = document.createElement("button");
            saveButton.innerHTML = '<i class="fas fa-download"></i>';
            saveButton.classList.add("save-image-button");

            saveButton.addEventListener("click", function(event) {
                event.stopPropagation();
                saveImage(imageUrl); // Calls the nested saveImage
            });
            container.appendChild(saveButton);

            async function saveImage(imageUrlToSave) {
                // Capacitor and Filesystem are assumed to be available globally if not on web
                const capPlatform = (typeof Capacitor !== 'undefined') ? Capacitor.getPlatform() : 'web';
                const now = new Date();
                const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                const fileName = `Olier_artwork_${timestamp}.png`;

                try {
                    const fetchResponse = await fetch(imageUrlToSave);
                    const blob = await fetchResponse.blob();

                    if (capPlatform === 'web') {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        const originalButtonText = saveButton.innerHTML;
                        saveButton.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => { saveButton.innerHTML = originalButtonText; }, 2000);
                    } else {
                        const { Filesystem } = Capacitor.Plugins; // Assuming Capacitor.Plugins is globally available
                        if (capPlatform === 'android') { // capPlatform is from the nested scope
                            let permission = await Filesystem.checkPermissions();
                            if (permission.publicStorage !== 'granted') {
                                permission = await Filesystem.requestPermissions();
                                if (permission.publicStorage !== 'granted') {
                                    alert('Storage permission denied.'); return;
                                }
                            }
                        }
                        const reader = new FileReader();
                        reader.onloadend = async function() {
                            const base64data = reader.result.split(',')[1];
                            await Filesystem.writeFile({
                                path: fileName, data: base64data, directory: 'DOCUMENTS', recursive: true
                            });
                            const originalButtonText = saveButton.innerHTML;
                            saveButton.innerHTML = '<i class="fas fa-check"></i>';
                            alert(`Image saved as ${fileName} in Documents.`);
                            setTimeout(() => { saveButton.innerHTML = originalButtonText; }, 2000);
                        };
                        reader.readAsDataURL(blob);
                    }
                } catch (fetchError) {
                    console.error('Error saving image:', fetchError);
                    alert('Failed to save image.');
                    saveButton.innerHTML = '<i class="fas fa-times"></i>';
                    setTimeout(() => { saveButton.innerHTML = '<i class="fas fa-download"></i>'; }, 2000);
                }
            }
        }
        // --- END OF NESTED HELPER FUNCTION ---
    });
    // ===============================================
    // END OF IMAGE GENERATION EVENT HANDLER
    // ===============================================



// ================================================================
// FUNCTIONS TO UPDATE the dropdown visibility based on the toggle
// ================================================================
    // Function to update the dropdown visibility based on the toggle
// scripts.js - inside updateSearchOptionsDropdown
function updateSearchOptionsDropdown() {
    // ... (guard clauses for $searchOptionsFrame and $searchToggle) ...
    if ($searchToggle.is(':checked')) { // Match mode
        console.log('[updateSearchOptionsDropdown] Adding hidden-by-toggle');
        $searchOptionsFrame.addClass('hidden-by-toggle');
    } else { // Seek mode
        $searchOptionsFrame.removeClass('hidden-by-toggle');
    }
}

    // Call it once on load to set the initial state based on the toggle's default
    updateSearchOptionsDropdown();

    // Listen for changes on the #searchToggle
    $searchToggle.on('change', function() {
        updateSearchOptionsDropdown();
        // Also update the search button text and sample questions visibility (existing logic)
        updateSearchMode(); // Assuming updateSearchMode is your existing function for this
    });
    
// ===============================================
// FUNCTIONS TO UPDATE OTHER ELEMENTS OF MAIN UI
// ===============================================
    function updateSearchMode() {
        if ($searchToggle.is(':checked')) {
            // Keyword Search Mode
            $searchBtn.text('Match');
            $searchBtn.addClass('match-mode'); // Make button blue
            $vectorSamples.hide();
            $keywordSamples.show();
        } else {
            // Vector Search Mode
            $searchBtn.text('Seek');
            $searchBtn.removeClass('match-mode'); // Revert button to default
            $vectorSamples.show();
            $keywordSamples.hide();
        }
    }

    // Initialize UI on page load
    updateSearchMode();

    // Listen for toggle switch changes
    $searchToggle.on('change', updateSearchMode);
    
    
    // Function to handle the visibility of buttons

    function toggleButtonVisibility(hide) {
        const openChatbotButton = $('.open_chatbot:not(.in-flex-box)');
        const zoomToTopButton = $('.zoom_to_top');

        if (hide) {
            openChatbotButton.addClass('vanish');
            zoomToTopButton.addClass('vanish');
        } else {
            openChatbotButton.removeClass('vanish');
            zoomToTopButton.removeClass('vanish');
        }
    }

    // Set up event listeners for the search input
    const $searchInput = $('#query');

    $searchInput.on('focus', function() {
        if (isMobile) {
            toggleButtonVisibility(true);
        }
    });

    $searchInput.on('blur', function() {
        if (isMobile) {
            if (readingModeActivated) {
                // If reading mode is active, the buttons should remain vanished.
                // Explicitly ensure they are vanished.
                toggleButtonVisibility(true);
            } else {
                // If reading mode is NOT active, then it's safe to allow them to un-vanish
                // (e.g., user was typing a regular search, then blurred).
                toggleButtonVisibility(false);
            }
        }
        // Optionally, you could call toggleOlierButton() after a tiny delay
        // to ensure all visibility rules are re-evaluated, but the above should be sufficient
        // for this specific issue. For example:
        // setTimeout(toggleOlierButton, 0);
    });
/*______________________New toggleOlierButton Function__________________________*/
let lastScrollTop = 0; // Keep track of the last scroll position globally

function toggleOlierButton() {
    const olierButton = document.querySelector('.open_chatbot:not(.in-flex-box)');
    const zoomToTopButton = document.querySelector('.zoom_to_top');
    const chatbox = document.getElementById('chatbox'); // Keep chatbox check

    if (!olierButton || !zoomToTopButton || !chatbox) return; // Exit if elements not found

    let currentScrollTop = window.scrollY || window.pageYOffset;
    const isChatboxOpen = chatbox.classList.contains('open');

    // --- Reading Mode Handling (uses .vanish) ---
    if (readingModeActivated) {
        olierButton.classList.add('vanish');
        zoomToTopButton.classList.add('vanish');
        // Ensure .hidden is removed if reading mode takes precedence
        olierButton.classList.remove('hidden');
        zoomToTopButton.classList.remove('hidden');
        lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop; // Update scroll pos even when vanished
        return; // Exit early
    } else {
        // Ensure .vanish is removed if not in reading mode
        olierButton.classList.remove('vanish');
        zoomToTopButton.classList.remove('vanish');
    }

 // --- Mobile + Chatbox Open Handling (Priority 2) ---
    // <<< START FIX >>>
    if (isChatboxOpen && isMobile) {
        olierButton.classList.add('hidden');     // Always hide chat button when chatbox open
        zoomToTopButton.classList.add('hidden'); // <<< THIS IS THE FIX: Always hide books button on mobile when chatbox open
        lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop; // Still update scroll pos
        return; // Exit early as mobile/open case is handled
    }
    // <<< END FIX >>>

    // --- Scroll Direction Handling (uses .hidden) ---

    // Always show buttons if chatbox is open AND user is near the top (or scrolls up to near top)
     if (isChatboxOpen && currentScrollTop <= 10) {
         olierButton.classList.add('hidden'); // Chat button stays hidden when chatbox open
         zoomToTopButton.classList.remove('hidden'); // Show Books button
     }
     // Always show buttons if chatbox is closed AND user is near the top (or scrolls up to near top)
     else if (!isChatboxOpen && currentScrollTop <= 10) {
        olierButton.classList.remove('hidden');
        zoomToTopButton.classList.remove('hidden');
     }
     // Handle scrolling down (hide buttons)
     else if (currentScrollTop > lastScrollTop) {
        olierButton.classList.add('hidden');
        zoomToTopButton.classList.add('hidden');
     }
     // Handle scrolling up (show buttons, respecting chatbox state)
     else if (currentScrollTop < lastScrollTop) {
         if (!isChatboxOpen) { // Show both if chatbox closed
             olierButton.classList.remove('hidden');
             zoomToTopButton.classList.remove('hidden');
         } else { // If chatbox open, only show Books button when scrolling up
            olierButton.classList.add('hidden');
            zoomToTopButton.classList.remove('hidden');
         }
     }

    // Update last scroll position for the next event
    lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop; // For Mobile or negative scrolling
}


// ... (Your other functions - autoResize, etc.)


/*______________________End of New toggleOlierButton Function__________________________*/



/*______________________Old toggleOlierButton Function__________________________

    function toggleOlierButton() {
        // Get references to elements
        const olierButton = document.querySelector('.open_chatbot:not(.in-flex-box)');
        const zoomToTopButton = document.querySelector('.zoom_to_top'); // Ensure this is defined
        const chatbox = document.getElementById('chatbox');
    
        // Determine states
        const isChatboxOpen = chatbox.classList.contains('open');
        const scrollPosition = window.scrollY || window.pageYOffset;

        if (readingModeActivated) {
            // **Always hide olierButton and zoomToTopButton when reading mode is active**
            if (olierButton) olierButton.classList.add('vanish');
            if (zoomToTopButton) zoomToTopButton.classList.add('vanish');
        } else {
            if (scrollPosition >= 100) {
                // User has scrolled down
    
                // Hide original buttons if chatbox is not open
                if (!isChatboxOpen) {
                    if (olierButton) olierButton.classList.add('hidden');
                    if (zoomToTopButton) zoomToTopButton.classList.add('hidden');
                } else {
                    if (olierButton) olierButton.classList.add('hidden');
                    if (zoomToTopButton) zoomToTopButton.classList.add('hidden');
                }
            } else {
                // At the top of the page
    
                // Hide original buttons if desired
                if (!isChatboxOpen) {
                    if (olierButton) olierButton.classList.remove('hidden');
                    if (zoomToTopButton) zoomToTopButton.classList.remove('hidden');
                } else {
                    if (olierButton) olierButton.classList.add('hidden');
                    // Add condition for mobile to hide zoomToTopButton when chatbot is open
                    if (isMobile) {
                        zoomToTopButton.classList.add('hidden');
                    } else {
                        zoomToTopButton.classList.remove('hidden');
                    }
                }
            }
        }
    
        adjustChatboxStyle();
    }
/*______________________End of Old toggleOlierButton Function__________________________ */ 

    
    // Event listener for scroll event
    window.addEventListener('scroll', function() {
        toggleOlierButton();
    });
    
    // Initial setup on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        adjustChatboxStyle();
        toggleOlierButton();
    
        // Initially hide the image and send buttons
        $("#img-btn").hide();
        $("#send-btn").hide();
    });


// Handle click for opening the settings menu
$(document).on('click', '.open_settings_menu', function(event) {
    console.log('Clicked:', $(this).attr('id') || $(this).attr('class'));

    // Just toggle the settings menu dropdown (no scroll check needed)
    event.preventDefault();
    event.stopPropagation();

    // Toggle the settings menu dropdown
    $('#settings-menu-dropdown').toggleClass('active');

    // Toggle ARIA expanded state
    let isExpanded = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', !isExpanded);
});

// Also handle closing the settings menu when the close button is clicked
$(document).on('click', '#settings-menu-dropdown .close-menu-btn', function(event) {
    event.preventDefault();
    $('#settings-menu-dropdown').removeClass('active');
    // Find the button that opened it and set aria-expanded back to false if needed
    $('.open_settings_menu').attr('aria-expanded', 'false');
});



// Handle click for .zoom_to_top (Books button)
$(document).on('click', '.zoom_to_top', function(event) {
    console.log('Clicked:', $(this).attr('id') || $(this).attr('class'));

    // Prevent default anchor behavior and stop event bubbling
    event.preventDefault();
    event.stopPropagation();

    // Always toggle the main menu dropdown regardless of scroll position
    $('#main-menu-dropdown').toggleClass('active');

    // Toggle ARIA expanded state for accessibility
    let isExpanded = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', !isExpanded);

    // --- REMOVED the else block that caused scrolling to top ---

    // If the menu is being opened and reading mode is active, expand the current book
    if ($('#main-menu-dropdown').hasClass('active') && readingModeActivated) {
        // Ensure the function exists before calling
        if (typeof expandCurrentBookInMenu === 'function') {
            expandCurrentBookInMenu();
        }
    }
});


// Font Size Adjuster
let fontSizePercentage = 100;

// Function to update the root font size
function updateRootFontSize() {
    $('html').css('font-size', fontSizePercentage + '%');
    localStorage.setItem('fontSizePercentage', fontSizePercentage);
}

// Load font size preference on page load
    const savedFontSize = localStorage.getItem('fontSizePercentage');
    if (savedFontSize) {
        fontSizePercentage = parseInt(savedFontSize);
        updateRootFontSize();
    }

// Event handler for increasing font size
$('#increase-font-btn').on('click', function(event) {
    event.stopPropagation(); // Prevents the event from bubbling up
    if (fontSizePercentage < 150) { // Set a maximum limit if desired
        fontSizePercentage += 10; // Increase font size by 10%
        updateRootFontSize();
    }
});

// Event handler for decreasing font size
$('#decrease-font-btn').on('click', function(event) {
    event.stopPropagation(); // Prevents the event from bubbling up
    if (fontSizePercentage > 50) { // Set a minimum limit if desired
        fontSizePercentage -= 10; // Decrease font size by 10%
        updateRootFontSize();
    }
});




// ===============================================
// READING VIEW FUNCTIONS
// ===============================================

// Apply Reading Mode Settings
/* =========================================================
 *    Search  ↔  Reading  view logic
 * =======================================================*/

/* ---------- cached elements ---------- */
const fullTextDiv   = document.getElementById('full-text');      // reading pane

/* ---------- UI flags & scroll memory ---------- */
let isSearchVisible        = true;   // true when Search pane is on screen
let searchScrollPosition   = 0;
let fullTextScrollPosition = 0;

/* ---------------------------------------------------------
 * 1.  Activate reading mode after user clicks a result
 * --------------------------------------------------------*/
function applyReadingMode() {
    // Hide the searchSpace by adding the 'closed' class
    if (searchSpace) searchSpace.classList.add('closed');

    // Show full-text
    if (fullText) fullText.style.display = 'block';

    // Activate bottom-flex-box
    if (bottomFlexBox) bottomFlexBox.style.display = 'flex';

    // Use toggleButtonVisibility to hide both buttons
    toggleButtonVisibility(true);

    // Set the reading mode flag to true
    readingModeActivated = true;
    // Synchronize isSearchVisible with UI state
    isSearchVisible = false;
}

// Ensure isSearchVisible is accessible

// Variables to store scroll positions

// Toggle Search Function using jQuery event delegation
$(document).on('click', '.toggle_search', function(event) {
    event.preventDefault();
    // event.stopPropagation();

    console.log('Toggle button clicked'); // Debugging

    if (isSearchVisible) {
        console.log('Hiding searchSpace, showing fullText');

        // Save the scroll position of the search view
        searchScrollPosition = $(window).scrollTop();

        // Hide the searchSpace by adding the 'closed' class
        $('.search-space').addClass('closed');

        // Show full-text
        $('#full-text').show();

        // Restore the scroll position of the full-text view
        $(window).scrollTop(fullTextScrollPosition);

        // Optionally adjust bottom-flex-box
        $('#bottom-flex-box').css('display', 'flex');

        // Update visibility state
        isSearchVisible = false;
    } else {

        // Save the scroll position of the full-text view
        fullTextScrollPosition = $(window).scrollTop();

        // Hide full-text
        $('#full-text').hide();

        // Show the searchSpace by removing the 'closed' class
        $('.search-space').removeClass('closed');

        // Restore the scroll position of the search view
        $(window).scrollTop(searchScrollPosition);

        // Optionally adjust bottom-flex-box
        $('#bottom-flex-box').css('display', 'flex');

        // Update visibility state
        isSearchVisible = true;
    }
});

// ... (Your other functions - toggleOlierButton, etc.)



// Utility function to throttle execution
function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Utility function to debounce execution
function debounce(func, wait) {
    let timeout;
    return function executedFunction() {
        const context = this;
        const args = arguments;
        
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

// Function to update the flex box center content with book and chapter titles
function updateFlexBoxCenterContent(bookTitle, chapterTitle) {
    // Update or create the book title element
    var $bookTitleElement = $('#flex-box-book-title');
    if ($bookTitleElement.length === 0) {
        $bookTitleElement = $('<div id="flex-box-book-title"></div>');
        $('.flex-box-center-content').append($bookTitleElement);
    }
    $bookTitleElement.text(bookTitle);

    // Update or create the chapter title element
    var $chapterTitleElement = $('#flex-box-chapter-title');
    if ($chapterTitleElement.length === 0) {
        $chapterTitleElement = $('<div id="flex-box-chapter-title"></div>');
        $('.flex-box-center-content').append($chapterTitleElement);
    }
    $chapterTitleElement.text(chapterTitle);
}

function waitForImagesAndDOM(callback) {
    let imagesLoaded = false;
    let domStable = false;

    // Function to check if both images are loaded and DOM is stable
    function checkReady() {
        if (imagesLoaded && domStable) {
            callback();
        }
    }

    // Images Loading
    const images = $('#full-text-content img');
    const totalImages = images.length;
    let loadedImages = 0;

    if (totalImages === 0) {
        // No images, proceed with imagesLoaded set to true
        imagesLoaded = true;
        checkReady();
    } else {
        images.each(function() {
            if (this.complete) {
                imageLoaded();
            } else {
                $(this).on('load', imageLoaded);
                $(this).on('error', imageLoaded); // Handle errors to prevent hanging
            }
        });
    }

    function imageLoaded() {
        loadedImages++;
        if (loadedImages === totalImages) {
            imagesLoaded = true;
            checkReady();
        }
    }

    // DOM Mutations
    const targetNode = document.getElementById('full-text-content');
    const observerOptions = {
        childList: true,
        subtree: true,
    };
    let mutationTimeout;

    const observer = new MutationObserver(() => {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            observer.disconnect();
            domStable = true;
            checkReady();
        }, 100); // Wait 100ms after the last mutation to consider DOM stable
    });

    observer.observe(targetNode, observerOptions);

    // Fallback in case no mutations occur
    setTimeout(() => {
        if (!domStable) {
            observer.disconnect();
            domStable = true;
            checkReady();
        }
    }, 200); // Adjust timeout as necessary
}

// Function to initialize chapter titles tracking
function initializeChapterTitleTracking() {
    // Clear previous data
    chapterTitlePositions = [];

    // Select all chapter titles in the content
    const chapterTitleElements = document.querySelectorAll('.Cp-Nm');


    // For each chapter title, get its position relative to the document
    chapterTitleElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const offsetTop = rect.top + window.pageYOffset;
        const titleText = el.textContent.trim();


        chapterTitlePositions.push({
            offsetTop: offsetTop,
            titleText: titleText
        });
    });
}

const viewportHeight = window.innerHeight;
const offsetPercentage = 0.1; // 10% of viewport height
const chapterOffsetThreshold = -viewportHeight * offsetPercentage;

function onScrollUpdateChapterTitle() {
    const header = document.querySelector('.your-fixed-header-class'); // Replace with your header's class or ID
    const headerHeight = header ? header.offsetHeight : 0;

    // Get current scroll position and adjust for header
    let scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    scrollPosition += headerHeight;

    // **Define the offset threshold**
    const chapterOffsetThreshold = -100; // Adjust this value as needed

    // Variable to hold the title of the chapter we're currently in
    let currentTitle = '';

    // Iterate through chapter titles
    for (let i = 0; i < chapterTitlePositions.length; i++) {
        const chapter = chapterTitlePositions[i];

        // Adjust the condition using the threshold
        if (scrollPosition >= chapter.offsetTop + chapterOffsetThreshold) {
            currentTitle = chapter.titleText;
        } else {
            break;
        }
    }

    // Update the chapter title if it has changed
    if (currentTitle !== currentChapterTitle) {
        currentChapterTitle = currentTitle;
        updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);
    }
}

// Create a throttled version of the scroll handler
const throttledScrollHandler = throttle(onScrollUpdateChapterTitle, 100);


// **Function to set up the ResizeObserver**
function setupResizeObserver() {
    if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(entries => {
            // Recalculate chapter positions after size changes
            initializeChapterTitleTracking();

            // Optionally, update the chapter title immediately
            onScrollUpdateChapterTitle();
        });

        // Observe the content that may change size
        const targetNode = document.getElementById('full-text-content');
        if (targetNode) {
            resizeObserver.observe(targetNode);
        }
    } else {
        // Fallback for browsers that do not support ResizeObserver
        window.addEventListener('resize', debounce(function() {
            initializeChapterTitleTracking();
            onScrollUpdateChapterTitle();
        }, 200));
    }
}

function onContentLoaded() {
    // Remove previous scroll handler to prevent multiple bindings
    window.removeEventListener('scroll', throttledScrollHandler);

    // Reset currentChapterTitle
    currentChapterTitle = '';

    // Update the flex box with the initial book title and empty chapter title
    updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);

    // Wait for images and DOM to be fully loaded before initializing chapter titles tracking
    waitForImagesAndDOM(function() {
        // Initialize chapter titles tracking after everything is loaded
        initializeChapterTitleTracking();

        // **Set up the ResizeObserver to monitor size changes**
        setupResizeObserver();

        // Attach the throttled scroll event listener
        window.addEventListener('scroll', throttledScrollHandler);

        // Trigger the scroll handler to set the initial chapter title
        onScrollUpdateChapterTitle();
    });
}




// BOOK MENU OPENING


function scrollToMenuItem($menuItem) {
    var $menu = $('#main-menu-dropdown');

    // Get the current scroll position of the menu
    var menuScrollTop = $menu.scrollTop();

    // Get the position of the menu and the item
    var menuTop = $menu.offset().top;
    var itemTop = $menuItem.offset().top;

    // Calculate the position of the item relative to the menu
    var scrollTo = menuScrollTop + itemTop - menuTop;

    // Scroll the menu instantly
    $menu.scrollTop(scrollTo);
}



function expandCurrentBookInMenu() {
    // Ensure currentBookTitle is defined and not empty
    if (!currentBookTitle || currentBookTitle.trim() === '') {
        console.warn('No current book title is set.');
        return;
    }

    // Find the book title element in the menu that matches currentBookTitle
    var $bookTitleElement = $('#main-menu-dropdown .book-title').filter(function() {
        return $(this).find('span').first().text().trim() === currentBookTitle;
    });

    if ($bookTitleElement.length > 0) {
        var $bookItem = $bookTitleElement.closest('.book-item');
        var $authorItem = $bookItem.closest('.author-item');

        expandAuthorItem($authorItem, function() {
            expandBookItem($bookItem, function() {
                // After expansions, scroll to the book item
                scrollToMenuItem($bookTitleElement);
            });
        });
    } else {
        console.warn('Current book title not found in the menu:', currentBookTitle);
    }
}

function expandAuthorItem($authorItem, callback) {
    if (!$authorItem.hasClass('expanded')) {
        $authorItem.addClass('expanded');
        var $booksList = $authorItem.find('.author-books');
        $booksList.slideDown(0, function() { // Duration set to 0 for instant expansion
            if (typeof callback === 'function') {
                callback();
            }
        });
    } else {
        if (typeof callback === 'function') {
            callback();
        }
    }
}

function expandBookItem($bookItem, callback) {
    if (!$bookItem.hasClass('expanded')) {
        $bookItem.addClass('expanded');
        var $chaptersList = $bookItem.find('.chapters-list');
        if ($chaptersList.length > 0) {
            $chaptersList.slideDown(0, function() { // Duration set to 0
                if (typeof callback === 'function') {
                    callback();
                }
            });
        } else {
            if (typeof callback === 'function') {
                callback();
            }
        }
    } else {
        if (typeof callback === 'function') {
            callback();
        }
    }
}

// Handle click on the flex-box-center-content
$(document).on('click', '.flex-box-center-content', function(event) {
    console.log('Clicked:', $(this).attr('class'));
    
    // Prevent default action and stop propagation
    event.preventDefault();
    event.stopPropagation();

    // Toggle the main menu dropdown
    $('#main-menu-dropdown').toggleClass('active');

    // Toggle ARIA expanded state
    let isExpanded = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', !isExpanded);
    
    // **New code to trigger click on currentBookTitle**
    if ($('#main-menu-dropdown').hasClass('active')) {
        // Call a function to expand the current book
        expandCurrentBookInMenu();
    }
});

// Handle click for the main-menu-btn
$('#main-menu-btn').on('click', function(event) {
    event.preventDefault();
    event.stopPropagation();  // Prevent default action if any

    // Toggle the font size adjuster container
    $('#font-change-container').toggle();

    // Toggle ARIA expanded state
    let isExpanded = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', !isExpanded);
});




    // Initialize ZingTouch on the main menu dropdown
    const menuElement = document.getElementById('main-menu-dropdown');

    if (menuElement) {
        // Create a ZingTouch region for the menu element
        const ztRegion = new ZingTouch.Region(menuElement, true, false);

        // Cache the close button element
        const closeButton = menuElement.querySelector('.close-menu-btn');

        // Adjust sensitivity options
        const swipeOptions = {
            maxRestTime: 100,  // Requires quicker swipes
            moveThreshold: 10, // Detects shorter swipes
            numInputs: 1      // Single-finger swipe
        };

        // Bind a swipe gesture to the menu element with adjusted sensitivity
        ztRegion.bind(menuElement, 'swipe', function(event) {
            // Check if the gesture started on the close button
            if (event.target === closeButton || closeButton.contains(event.target)) {
                // Do not handle swipe if it started on the close button
                return;
            }

            const currentGesture = event.detail.data[0];

            // Get the direction of the swipe
            let swipeAngle = currentGesture.currentDirection;

            // Normalize the angle to be between 0 and 360
            swipeAngle = (swipeAngle + 360) % 360;

            console.log('Swipe angle:', swipeAngle);

            // Detect swipe left (swipe angle between 135 degrees and 225 degrees)
            if (swipeAngle >= 135 && swipeAngle <= 225) {
                console.log('Swipe left detected', event);
                closeMenu();
            }
        }, swipeOptions);
    } else {
        console.error('Menu element not found for gesture initialization.');
    }

    // Close menu click handler remains the same
    $(document).on('click', '.close-menu-btn', function(event) {
        event.stopPropagation();
        closeMenu();
    });

    // Function to close the menu
    function closeMenu() {
        $('#main-menu-dropdown').removeClass('active');
        $('#main-menu-btn').attr('aria-expanded', 'false');
    }



// Updated document click handler
$(document).on('click', function(event) {
    if (!$(event.target).closest('#main-menu-dropdown').length && 
        !$(event.target).closest('#font-change-container').length) {
        
        // Hide the font size adjuster container
        $('#font-change-container').hide();
        
        // Close the main menu dropdown
        $('#main-menu-dropdown').removeClass('active');

        // Reset ARIA expanded states
        $('#main-menu-btn').attr('aria-expanded', 'false');
    }
});

    // Hide dropdown and font size adjuster when clicking outside
    $(document).on('click', function(event) {
        var $target = $(event.target);
    
        // If click is outside main menu and related elements, close main menu
        if (!$target.closest('#main-menu-dropdown, #main-menu-btn, #font-change-container, .zoom_to_top').length) {
            $('#font-change-container').hide();
            $('#main-menu-dropdown').removeClass('active');
            $('#main-menu-btn, .zoom_to_top').attr('aria-expanded', 'false');
        }
    
        // If click is outside settings menu and its trigger button, close settings menu
        if (!$target.closest('#settings-menu-dropdown, #settings-menu-btn').length) {
            $('#settings-menu-dropdown').removeClass('active');
            $('#settings-menu-btn').attr('aria-expanded', 'false');
        }
    });
    


// Handle click on author headers to expand/collapse books
$('#main-menu-dropdown').on('click', '.author-header', function(event) {
    event.stopPropagation(); // Prevent the event from bubbling up
    var $authorItem = $(this).closest('.author-item');
    var $booksList = $authorItem.find('.author-books');
    $booksList.slideToggle(200); // Toggle the visibility of the book list
    $authorItem.toggleClass('expanded'); // Toggle the expanded class to rotate the icon
});

// Handle click on book titles to expand/collapse nested items
$('#main-menu-dropdown').on('click', '.book-title', function(event) {
    event.stopPropagation();
    var $bookItem = $(this).closest('.book-item');
    // Toggle the expanded class on the book item
    $bookItem.toggleClass('expanded');
});


// Handle click on "Cover" link
$('#main-menu-dropdown').on('click', '.cover-link', function(event) {
    event.stopPropagation();
    event.preventDefault();

    // 1) Identify book/file data
    var $bookItem = $(this).closest('.book-item');
    var filePath = $bookItem.data('file-path');

    // Extract the new book title from the file path
    var newBookTitle = filePath.split('/').pop().replace('_modified.html', '').trim();

    // Reset current chapter
    currentChapterTitle = '';

    // 2) Decide if we need to load the new book or just scroll
    if (currentBookTitle !== newBookTitle) {
        // Update currentBookTitle
        currentBookTitle = newBookTitle;

        // Update the flex box center content
        updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);
        applyReadingMode();

        // Load the full text of the new book
        loadFullText(filePath, function() {
            // After loading, scroll to the top
            scrollToTop();
        });

    } else {
        // Book is already loaded, just scroll to the top
        scrollToTop();
    }

    // Hide the dropdown and font size adjuster after selection
    $('#main-menu-dropdown').removeClass('active');
});

function scrollToTop() {
    const $content = $('#full-text-content');
    if (!$content.length) {
        console.warn("#full-text-content not found; cannot scroll.");
        return;
    }

    // Scroll to the top of #full-text-content
    $content[0].scrollIntoView({ behavior: 'instant', block: 'start' });
}

// Handle click on PDF "Cover" link
$('#main-menu-dropdown').on('click', '.pdf-cover-link', function(event) {
    event.stopPropagation();
    event.preventDefault();

    var $bookItem = $(this).closest('.nested-item, .book-item');
    var filePath = $bookItem.data('file-path');
    if (!filePath) {
      console.error("No file path found!");
      return;
    }
    var newBookTitle = filePath.split('/').pop().replace('.pdf', '').trim();

    // Reset or set your current book/chapter tracking variables
    currentChapterTitle = '';
    currentBookTitle = newBookTitle;

    // Update the flex box center content or other UI elements, if needed
    updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);
    applyReadingMode();

    // Now load the PDF using your loadPdf function
    loadPdf(filePath, function() {
        // Scroll to top after loading
        window.scrollTo(0, 0);
    });

    // Hide the dropdown after selection (optional)
    $('#main-menu-dropdown').removeClass('active');
});



// Handle click on chapter links
$('#main-menu-dropdown').on('click', '.chapter-link', function(event) {
    event.preventDefault(); // Prevent default navigation

    var anchor = $(this).attr('href');
    var $bookItem = $(this).closest('.book-item');
    var filePath = $bookItem.data('file-path');

    // Extract the new book title from the file path
    var newBookTitle = filePath.split('/').pop().replace('_modified.html', '').trim();

    // Update current chapter title
    currentChapterTitle = ''; // Reset chapter title, will be updated by observer

    // **Check if the search view is visible**
    if (isSearchVisible) {
        // **Trigger the toggle to hide the search space and show full text**
        $('.toggle_search').click();
    }

    // Check if the current book is already loaded
    if (currentBookTitle !== newBookTitle) {
        // Update currentBookTitle
        currentBookTitle = newBookTitle;

        // Update the flex box center content
        updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);
        applyReadingMode();

        // Load the full text of the new book
        loadFullText(filePath, function() {
            // After loading, scroll to the anchor
            scrollToAnchor(anchor);
        });
    } else {
        // Book is already loaded, just scroll to the anchor
        scrollToAnchor(anchor);
    }

    // Hide the main menu dropdown and font size adjuster
    $('#main-menu-dropdown').removeClass('active');
});

// Handle "Enter" keypress on author headers and book titles for accessibility
$('#main-menu-dropdown').on('keypress', '.author-header, .book-title', function(event) {
    if (event.key === "Enter") {
        $(this).click();
    }
});

// Remove keypress handler for part titles as they are not clickable


// Keyboard accessibility: Close dropdown with Esc key
$(document).on('keydown', function(event) {
    if (event.key === "Escape") { // Check if the pressed key is Esc
        $('#main-menu-dropdown').removeClass('active');
        $('#font-change-container').hide();
        $('#main-menu-btn, .zoom_to_top').attr('aria-expanded', 'false');
    }
});
function scrollToAnchor(anchor) {
    adjustChatboxStyle(); // Ensure layout is up to date before measuring

    let imagesLoaded = false;
    let domStable = false;

    // We'll assume #full-text-content is your scrollable container/content
    const $content = $('#full-text-content');
    if (!$content.length) {
        console.warn("#full-text-content not found; cannot scroll.");
        return;
    }

    // Check for images + DOM mutations before scrolling
    function checkReady() {
        if (imagesLoaded && domStable) {
            proceedWithScrolling();
        }
    }

    // 1) Image loading logic
    const $images = $content.find('img');
    const totalImages = $images.length;
    let loadedCount = 0;

    if (totalImages === 0) {
        imagesLoaded = true;
        checkReady();
    } else {
        $images.each(function() {
            if (this.complete) {
                imageLoaded();
            } else {
                $(this).on('load', imageLoaded);
                $(this).on('error', imageLoaded);
            }
        });
    }

    function imageLoaded() {
        loadedCount++;
        if (loadedCount === totalImages) {
            imagesLoaded = true;
            checkReady();
        }
    }

    // 2) DOM mutation observer
    const targetNode = $content[0];
    const observer = new MutationObserver(() => {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            observer.disconnect();
            domStable = true;
            checkReady();
        }, 100);
    });
    let mutationTimeout;

    observer.observe(targetNode, { childList: true, subtree: true });

    // Fallback in case no mutations occur
    setTimeout(() => {
        if (!domStable) {
            observer.disconnect();
            domStable = true;
            checkReady();
        }
    }, 200);

    // 3) Once ready, fade in content, then scroll to the anchor near top
    function proceedWithScrolling() {
        const $target = $(anchor);
        if (!$target.length) {
            console.warn('Target not found for:', anchor);
            return;
        }

        // Hide content first
        $content.css('opacity', 0);

        // Adjust layout if needed
        adjustChatboxStyle();

        // Fade in, then scroll
        requestAnimationFrame(() => {
            $content.animate({ opacity: 1 }, 200, function() {
                $target[0].scrollIntoView({
                    behavior: 'instant',  // or 'smooth'
                    block: 'start'        // align target near top
                });
            });
        });
    }
}



function loadFullText(filePath, callback) {
    // Start the loader animation
    startViewDetailLoaderAnimation();

    $('#full-text').empty().show();
    $('#full-text').append('<div id="full-text-content" class="full-text-content"></div>');
    
    // Since filePath is hardcoded and safe, we can use it directly
    const safeFilePath = filePath; // Use filePath directly

    // Store the current file path
    $('#full-text').data('current-file', filePath);

    const contentLoaded = function() {
        // Stop the loader animation
        stopViewDetailLoaderAnimation();

        // Instead of insertOliButtons(), call intersection observer setup
        if (typeof initializeOliObserver === 'function' && typeof setupOliIntersection === 'function') {
            initializeOliObserver();   // creates the global observer
            setupOliIntersection();    // observes all paragraphs
        }

        // Execute the callback if provided
        if (typeof callback === 'function') {
            callback();
        }
    };

    const contentLoadFailed = function(jqXHR, textStatus, errorThrown) {
        $('#full-text-content').html('<p>An error occurred while loading the content.</p>');
        console.error('Error loading full text:', textStatus, errorThrown);

        // Stop the loader animation
        stopViewDetailLoaderAnimation();
    };

    if (isWeb) {
        // Web capPlatform - fetch from server
        $.get(serverUrl + '/api/full-text', { file_path: safeFilePath }, function(data) {
            $('#full-text-content').html(data);
            contentLoaded();
            requestAnimationFrame(function() {
                onContentLoaded();
            });

        }).fail(contentLoadFailed);
    } else {
        // Mobile app - load from local assets
        const localFilePath = safeFilePath; // Use safeFilePath directly
        
        // Debugging: Log the local file path
        console.log('Attempting to load local file:', localFilePath);

        $.get(localFilePath, function(data) {
            $('#full-text-content').html(data);
            contentLoaded();
            onContentLoaded();
        }).fail(contentLoadFailed);
    }
}
/**
 * Load a PDF file from the server endpoint and display it in the #full-text container
 * with the same styling as your HTML content.
 *
 * @param {string} filePath - The path to the PDF file.
 * @param {function} [callback] - (Optional) A function that will be called after the PDF is loaded.
 */
function loadPdf(filePath, callback) {
    startViewDetailLoaderAnimation();

    // Clear old content and show the container
    $('#full-text').empty().show();

    // Create the same structure as loadFullText
    $('#full-text').append('<div id="full-text-content" class="full-text-content"></div>');

    // For web deployment, fetch from your server endpoint
    const pdfUrl = `${serverUrl}/api/full-pdf?file_path=${encodeURIComponent(filePath)}`;

    fetch(pdfUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('PDF response was not OK: ' + response.statusText);
            }
            return response.blob();
        })
        .then(blob => {
            const objectUrl = URL.createObjectURL(blob);

            // Create the <iframe> and style it to fit your container
            const iframe = $('<iframe>', {
                class: 'pdf-frame',
                src: objectUrl,
                // Let width = 100% so it fills the container
                // You can choose a min-height or set a fixed height
                style: 'width: 100%; min-height: 1000px; border: none;'
            });

            // Insert the iframe inside the #full-text-content div
            $('#full-text-content').append(iframe);

            stopViewDetailLoaderAnimation();

            if (typeof callback === 'function') {
                callback();
            }
        })
        .catch(error => {
            console.error('Error loading PDF:', error);
            $('#full-text-content').append('<p>An error occurred while loading the PDF.</p>');
            stopViewDetailLoaderAnimation();
        });
}


// Keyboard accessibility: Close dropdown with Esc key
$(document).on('keydown', function(event) {
    if (event.key === "Escape") { // Check if the pressed key is Esc
        $('#main-menu-dropdown').removeClass('active');
        $('#main-menu-btn').attr('aria-expanded', 'false');
    }
});




// OLI BUTTONS FUNCTIONS Integrating Reading and AI Commentary

// Oli button in search results

$(document).on('click', '.oli-button', function(event) {
    event.stopPropagation();
    isFirstMessageAfterOliClick = true;
    var fullText = decodeURIComponent($(this).data('full-text'));
    var author = encodeURIComponent($(this).data('author') || 'Unknown Author');
    var chapterTitle = encodeURIComponent($(this).data('chapter-title') || 'Unknown Chapter');
    var bookTitle = encodeURIComponent($(this).data('book-title') || 'Unknown Book');
    

        // Existing desktop behavior with metadata
        handleOliButtonClick(fullText, decodeURIComponent(author), decodeURIComponent(chapterTitle), decodeURIComponent(bookTitle));
});


// / handleOliButtonClick function
function handleOliButtonClick(fullText, author, chapterTitle, bookTitle) {
    // 1) Set flags and metadata upfront
    hasImageButtonBeenClicked = false;
    isFirstMessageAfterOliClick = true;
    oliMetadata = {
        author: author,
        chapterTitle: chapterTitle,
        bookTitle: bookTitle
    };

    // 2) Open the chatbox first (or adjust if already open)
    if (!document.getElementById("chatbox").classList.contains("open")) {
        if (isMobile) {
            openChatboxSimplified();
        } else {
            openChatboxAndAdjustScroll();
        }
    } else {
        adjustChatboxStyle();
    }

    // 3) Format the prompt AFTER the chatbox is opened
    const finalPrompt = `Olier, please comment the following passage by ${author}, from the chapter "${chapterTitle}" of the book "${bookTitle}" in simple terms: "${fullText}"`;

    // 4) Set the chat input value and dispatch `input`
    const chatInput = document.getElementById("chat-input");
    chatInput.value = finalPrompt;
    chatInput.dispatchEvent(new Event('input'));


    // 5) Show the image button
    $("#img-btn").show();
    adjustChatboxHeight();
}



// Global IntersectionObserver reference for Oli buttons in books

let oliObserver;

function initializeOliObserver() {
// Create the Intersection Observer
oliObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const para = $(entry.target);
            // We only want to do this once per paragraph
            observer.unobserve(entry.target);

            // Proceed with your scanning logic
            const classes = para.attr('class') ? para.attr('class').split(' ') : [];
            if (classes.includes('P')) {
                const searchId = para.attr('search_id') || '';

                // We'll scan forward through paragraphs, skipping
                // p-num, sec-br, and footnote classes.
                let nextElement = para.nextAll('p').first();

                // While the next paragraph is one of the "skip" classes, keep going
                while (
                    nextElement.length &&
                    (nextElement.hasClass('p-num') ||
                     nextElement.hasClass('sec-br') ||
                     nextElement.hasClass('footnote'))
                ) {
                    nextElement = nextElement.nextAll('p').first();
                }

                // Now check if the next paragraph is "PE"
                if (nextElement.length && nextElement.hasClass('PE')) {
                    // Place the button at the PE paragraph
                    insertOliButton(nextElement, searchId);
                } else {
                    // Otherwise, place the button at the original P
                    insertOliButton(para, searchId);
                }
            }
        }
    });
}, {
    // IntersectionObserver options
    root: null,     // Use the browser viewport as the container
    threshold: 0.1  // Trigger when at least 10% of paragraph is visible
});
}

/**
* Call this function once when the document is ready, 
* after the paragraphs are in the DOM.
*/
function setupOliIntersection() {
// Find all paragraphs of class "P"
const contentParas = $('#full-text-content').find('p.P');
// Observe each "P" paragraph
contentParas.each(function() {
    oliObserver.observe(this);
});
}
function insertOliButton(targetPara, searchId) {
// Create the Oli button with only the search_id
const oliButton = $('<button>', {
    // Use only one class below (whichever name you actually need):
    class: 'oli-button-paragraph',
    text: 'O!',
    attr: {
        'data-search-id': searchId
    }
});

// Create a wrapper <span> to reset font-size
const buttonWrapper = $('<span>', {
    class: 'oli-button-wrapper'
}).css({
    'font-size': 'initial'
});

// Append the button to the wrapper and then to the target paragraph
buttonWrapper.append(oliButton);
targetPara.append(buttonWrapper);
}

// When an O! button is clicked
$(document).on('click', '.oli-button-paragraph', function(event) {
    event.stopPropagation();
    const oliButton = $(this);

    // Extract the search_id from the button
    const searchId = oliButton.attr('data-search-id');

    // Fetch metadata and text from the backend using search_id
    $.get(serverUrl + '/api/get-content-by-id', { search_id: searchId }, function(response) {
        const fullText = response.text || '';
        const author = response.author || 'Unknown Author';
        const bookTitle = response.book_title || 'Unknown Book';
        const chapterTitle = response.chapter_title || 'Unknown Chapter';

        handleDynamicOliButtonClick(fullText, author, chapterTitle, bookTitle);
    }).fail(function(xhr) {
        console.error('Error fetching content by id:', xhr);
    });
});

function handleDynamicOliButtonClick(fullText, author, chapterTitle, bookTitle) {
    // 1) Set flags and metadata first
    hasImageButtonBeenClicked = false;
    isFirstMessageAfterOliClick = true;
    dynamicOliMetadata = { author, chapterTitle, bookTitle };

    // 2) If the chatbox is closed, open it FIRST
    if (!document.getElementById("chatbox").classList.contains("open")) {
        if (isMobile) {
            openChatboxSimplified();
        } else {
            openChatboxAndAdjustScroll();
        }
    } else {
        adjustChatboxStyle();
        // or adjustChatboxHeight() if that’s your direct height logic
    }

    // 3) Now, after opening, set the chat input value
    const finalPrompt = `Olier, please comment the following passage by ${author}, from the chapter "${chapterTitle}" of the book "${bookTitle}" in simple terms: "${fullText}"`;
    const chatInput = document.getElementById("chat-input");
    chatInput.value = finalPrompt;
    chatInput.dispatchEvent(new Event('input'));


    // 4) Show the image button
    $("#img-btn").show();
    adjustChatboxHeight();
}





    


});

    


    