$(document).ready(function() {
    const serverUrl = 'https://8c31be54e6fac00f.ngrok.app';

    // Detect the platform using Capacitor
    const platform = (typeof Capacitor !== 'undefined') ? Capacitor.getPlatform() : 'web';
    const isWeb = platform === 'web';

    // Existing variable declarations
    let isFirstMessageAfterOliClick = false;
    let hasImageButtonBeenClicked = false;
    let isMobile = window.innerWidth <= 767; // Mobile devices
    window.addEventListener('resize', function() {
        isMobile = window.innerWidth <= 767;
    });

    // Variables to keep track of the current book and chapter titles
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
    const chatbox = document.getElementById('chatbox');
    // Initialize Hammer.js on the chatbox element
    var hammer = new Hammer(chatbox, {
        touchAction: 'pan-y'
    });
    const resizer = document.getElementById('chatbox-resizer');
    const mainContent = document.querySelector('.container');
    const bottomFlexBox = document.getElementById('bottom-flex-box');
    const $searchToggle = $('#searchToggle');
    const $searchBtn = $('#search-btn');
    const $vectorSamples = $('.vector-sample-questions');
    const $keywordSamples = $('.keyword-sample-questions');
    // **Elements to hide/show based on reading mode**
    const sampleQuestions = document.querySelector('.sample-questions');
    const fullText = document.getElementById('full-text');

    let readingModeActivated = false; // Global flag to track if reading mode is active
// www/static/scripts.js

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
            toggleButtonVisibility(false);
        }
    });



// Apply Reading Mode Settings
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
var isSearchVisible = true; // Global variable to track visibility state

// Variables to store scroll positions
var searchScrollPosition = 0;
var fullTextScrollPosition = 0;

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



// Adjust Chatbox Height Function
    function adjustChatboxHeight() {
        const chatInputContainer = document.getElementById('chat-input-container');
        const chatInputContainerHeight = chatInputContainer.offsetHeight;

        // Use window.visualViewport.height if available for accurate height when keyboard is open
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const chatboxTopOffset = chatbox.getBoundingClientRect().top;
        const availableHeight = viewportHeight - chatboxTopOffset;

        // Set the chatbox height
        chatbox.style.height = `${availableHeight}px`;

        // Adjust the messages container height
        const messages = document.getElementById('messages');
        const topChatboxHeight = document.querySelector('.top-chatbox').offsetHeight;
        const messagesHeight = availableHeight - topChatboxHeight - chatInputContainerHeight;

        messages.style.height = `${messagesHeight}px`;

        // Scroll to the bottom of the messages
        messages.scrollTop = messages.scrollHeight;
    }

    // // Initial calls to adjust styles and heights
    adjustChatboxStyle();

    // Adjust Chatbox Style Function
    function adjustChatboxStyle() {
        // Determine device type

        let isKeyboardOpen = document.body.classList.contains('keyboard-open');

        if (isMobile) {
            chatbox.style.width = '100%'; // 100% width on mobile
        } else {
            // Retrieve width from localStorage or set default for desktops
            let storedChatboxWidth = localStorage.getItem('chatboxWidth');
            if (storedChatboxWidth) {
                chatbox.style.width = storedChatboxWidth + 'px';
            } else {
                chatbox.style.width = '40%'; // Default width on desktops
            }
        }
        

        // Common styles
        // Remove height setting here; handled by adjustChatboxHeight()
        chatbox.style.top = '0';
        chatbox.style.right = '0';
        chatbox.style.position = 'fixed';

        if (chatbox.classList.contains('open')) {
            chatbox.style.display = 'block';
            let chatboxWidth = chatbox.offsetWidth;
        
            if (isMobile) {
                // Hide main content and bottom-flex-box on mobile when chatbox is open
                mainContent.style.visibility = 'hidden';
                bottomFlexBox.style.visibility = 'hidden';
        
                // Adjust chat input container positioning when keyboard is open
                const chatInputContainer = document.getElementById('chat-input-container');
        
                if (isKeyboardOpen) {
                    // When keyboard is open
                    chatInputContainer.style.position = 'absolute';
                    chatInputContainer.style.bottom = 'auto';
                } else {
                    // When keyboard is closed
                    chatInputContainer.style.position = 'fixed';
                    chatInputContainer.style.bottom = '0';
                }
        
            } else {
                // Adjust main content for tablets and desktops
                mainContent.style.visibility = 'visible'; // Ensure visibility is set
                let mainContentWidth = document.body.clientWidth - chatboxWidth;
                mainContent.style.width = mainContentWidth + 'px';
                mainContent.style.marginRight = chatboxWidth + 'px';
                mainContent.style.marginLeft = '0';
        
                // Adjust bottom-flex-box width
                bottomFlexBox.style.visibility = 'visible'; // Ensure visibility is set
                bottomFlexBox.style.width = mainContentWidth + 'px';
                bottomFlexBox.style.marginRight = chatboxWidth + 'px';
                bottomFlexBox.style.marginLeft = '0';
            }
        
            chatbox.style.transform = 'translateX(0)';
        } else {
            // Reset main content styles when chatbox is closed
            mainContent.style.visibility = 'visible';
            mainContent.style.width = '100%';
            mainContent.style.marginRight = 'auto';
            mainContent.style.marginLeft = 'auto';
        
            // Reset bottom-flex-box styles
            bottomFlexBox.style.visibility = 'visible';
            bottomFlexBox.style.width = '100%';
            bottomFlexBox.style.marginRight = '0';
            bottomFlexBox.style.marginLeft = '0';
        
            chatbox.style.transform = 'translateX(100%)';
        }
            // Adjust chatbox height after style adjustments
    adjustChatboxHeight();
}
    // Adjust styles and heights on window resize
    window.addEventListener('resize', function() {
        adjustChatboxStyle();
    });

// Resizer functionality



// Function to handle both mouse and touch down events
function resizerDown(e) {
    // Only enable resizing on tablets and desktops
    if (window.innerWidth > 767) {
        isResizing = true;

        // Determine the clientX position based on event type
        if (e.type === 'mousedown') {
            lastDownX = e.clientX;
        } else if (e.type === 'touchstart') {
            lastDownX = e.touches[0].clientX;
        }

        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    }
}

// Add event listeners for mouse and touch down events
resizer.addEventListener('mousedown', resizerDown);
resizer.addEventListener('touchstart', resizerDown);

// Function to handle both mouse and touch move events
function documentMove(e) {
    if (!isResizing) return;

    // Get the clientX position based on event type
    let clientX;
    if (e.type === 'mousemove') {
        clientX = e.clientX;
    } else if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
    }

    // Resizing logic remains the same
    let offsetRight = document.body.clientWidth - clientX;

    // Set minimum and maximum widths
    let minChatboxWidth = 300; // Minimum width in pixels
    let maxChatboxWidth = 800; // Maximum width in pixels

    // Calculate the new width
    let newChatboxWidth = Math.min(Math.max(offsetRight, minChatboxWidth), maxChatboxWidth);

    // Adjust the widths
    chatbox.style.width = newChatboxWidth + 'px';

    // Adjust main content width and margin
    let mainContentWidth = document.body.clientWidth - newChatboxWidth;
    mainContent.style.width = mainContentWidth + 'px';
    mainContent.style.marginRight = newChatboxWidth + 'px';
    mainContent.style.marginLeft = '0';

    // Adjust bottom-flex-box width
    bottomFlexBox.style.width = mainContentWidth + 'px'; // Ensure alignment
    bottomFlexBox.style.marginRight = newChatboxWidth + 'px';

    e.preventDefault();

    // Adjust chatbox height after resizing
    adjustChatboxHeight();
}

// Add event listeners for mouse and touch move events
document.addEventListener('mousemove', documentMove);
document.addEventListener('touchmove', documentMove);

// Function to handle both mouse and touch up events
function documentUp(e) {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';

        // Save chatbox width to localStorage
        let chatboxWidth = chatbox.offsetWidth;
        localStorage.setItem('chatboxWidth', chatboxWidth);

        // Adjust chatbox height after resizing
        adjustChatboxHeight();
    }
}

// Add event listeners for mouse and touch up events
document.addEventListener('mouseup', documentUp);
document.addEventListener('touchend', documentUp);

// Ensure this script runs after the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chat-input');

    chatInput.addEventListener('input', function() {
        // Reset the height to allow shrinking when deleting text
        this.style.height = 'auto';
        // Set the height to the scroll height, or max-height if exceeded
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    chatInput.addEventListener('focus', function() {
        document.body.classList.add('keyboard-open');
        setTimeout(function() {
            adjustChatboxStyle();
        }, 300); // Delay to wait for keyboard to appear
    });

    chatInput.addEventListener('blur', function() {
        document.body.classList.remove('keyboard-open');
        setTimeout(function() {
            adjustChatboxStyle();
        }, 300); // Delay to wait for keyboard to disappear
    });
});


    // Function to update UI based on toggle state
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
    

    function toggleOlierButton() {
        // Get references to elements
        const olierButton = document.querySelector('.open_chatbot:not(.in-flex-box)');
        const zoomToTopButton = document.querySelector('.zoom_to_top'); // Ensure this is defined
        const chatbox = document.getElementById('chatbox');
    
        // Determine states
        const isChatboxOpen = chatbox.classList.contains('open');
        const scrollPosition = window.scrollY || window.pageYOffset;
        // const isMobile = window.innerWidth <= 768; // Example threshold for mobile devices
    
        if (readingModeActivated) {
            // **Always hide olierButton and zoomToTopButton when reading mode is active**
            if (olierButton) olierButton.classList.add('vanish');
            if (zoomToTopButton) zoomToTopButton.classList.add('vanish');
        } else {
            if (scrollPosition >= 10) {
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
    
    // Adjust other functions and event listeners as before
    
    // // Function to update zoom_to_top button's text
    // function updateZoomToTopButtonText() {
    //     const scrollPosition = $(window).scrollTop();
    //     const $zoomButtonText = $('.zoom_to_top span');
    
    //     if (scrollPosition <= 10) {
    //         $zoomButtonText.text('Books');
    //     } else {
    //         $zoomButtonText.text('Top');
    //     }
    // }
    
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


    // Configure Hammer.js to detect swipe left
    hammer.get('swipe').set({
        direction: Hammer.DIRECTION_LEFT, 
        threshold: 10,
        velocity: 0.3,
    });

    // Add event listener for swipe left
    hammer.on('swipeleft', function(event) {
        // Close the chatbox on swipe left
        closeChatbox();
    });
// Add event listener for swipe events
hammer.on('swipe', function(event) {
    console.log('Swipe detected:', event);
});

// Also test for swipeleft specifically
hammer.on('swipeleft', function(event) {
    console.log('Swipe left detected:', event);
    closeChatbox();
});

// Close chatbot click handler
$(".close-icon").on("click", function(event) {
    event.stopPropagation();
    closeChatbox();
});

// Function to close the chatbox
function closeChatbox() {
    var pageNumElementId = null;
    // Only perform scroll adjustment if not on a mobile device
    if (!isMobile) {
        // Step 1: Capture the closest page number element from the bottom
        var pageNumElement = getClosestPageNumElementFromBottom();
        pageNumElementId = pageNumElement ? pageNumElement.id : null;
    }

    // Close the chatbox
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

    // Only perform scroll adjustment if not on a mobile device
    if (!isMobile) {
        // Step 3: After DOM has reflowed, scroll back to the captured element
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                if (pageNumElementId) {
                    // Find the element by ID
                    var targetElement = document.getElementById(pageNumElementId);
                    if (targetElement) {
                        // Scroll to the element
                        targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
                    } else {
                        console.warn('Element with ID not found after closing chatbox:', pageNumElementId);
                    }
                } else {
                    console.warn('No page number element found before closing chatbox.');
                }
            });
        });
    }
}

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



// READING VIEW FUNCTIONS


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
    const chapterTitleElements = document.querySelectorAll('.chapter_title');

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

function onScrollUpdateChapterTitle() {
    const header = document.querySelector('.your-fixed-header-class'); // Replace with your header's class or ID
    const headerHeight = header ? header.offsetHeight : 0;

    // Get current scroll position and adjust for header
    let scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    scrollPosition += headerHeight;


    // Variable to hold the title of the chapter we're currently in
    let currentTitle = '';

    // Iterate through chapter titles
    for (let i = 0; i < chapterTitlePositions.length; i++) {
        const chapter = chapterTitlePositions[i];
   
        if (scrollPosition >= chapter.offsetTop - 10) { // Adjust offset as needed
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

// Function to handle content load
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

        // Attach the throttled scroll event listener
        window.addEventListener('scroll', throttledScrollHandler);

        // Trigger the scroll handler to set the initial chapter title
        onScrollUpdateChapterTitle();
    });
}

// Create a throttled version of the scroll handler
const throttledScrollHandler = throttle(onScrollUpdateChapterTitle, 100);



// Handle click forzoom_to_top 
$(document).on('click', '.zoom_to_top', function(event) {
    console.log('Clicked:', $(this).attr('id') || $(this).attr('class'));
    let scrollPosition = $(window).scrollTop();

    if (scrollPosition <= 60) {
        // Page is at the top, activate the main menu dropdown
        event.preventDefault();
        event.stopPropagation();  // Prevent default action if any

        // Toggle the main menu dropdown
        $('#main-menu-dropdown').toggleClass('active');

        // Toggle ARIA expanded state
        let isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
    } else {
        // Page is not at the top, scroll to the top
        window.scrollTo(0, 0);
    }
});



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



$(document).on('click', '.close-menu-btn', function(event) {
    event.stopPropagation();
    $('#main-menu-dropdown').removeClass('active');
    $('#main-menu-btn').attr('aria-expanded', 'false');
});

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
        if (!$(event.target).closest('#main-menu-dropdown, #main-menu-btn, #font-change-container, .zoom_to_top').length) {
            $('#font-change-container').hide();
            $('#main-menu-dropdown').removeClass('active');
            $('#main-menu-btn, .zoom_to_top').attr('aria-expanded', 'false');
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

    var $bookItem = $(this).closest('.book-item');
    var filePath = $bookItem.data('file-path');

    // Extract the new book title from the file path
    var newBookTitle = filePath.split('/').pop().replace('_modified.txt', '').trim();

    // Update current chapter title
    currentChapterTitle = ''; // Reset chapter title

    // Check if the current book is already loaded
    if (currentBookTitle !== newBookTitle) {
        // Update currentBookTitle
        currentBookTitle = newBookTitle;

        // Update the flex box center content
        updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);
        applyReadingMode();

        // Load the full text of the new book
        loadFullText(filePath, function() {
            // After loading, scroll to the top (cover)
            window.scrollTo(0, 0);
        });
    } else {
        // Book is already loaded, just scroll to the top (cover)
        window.scrollTo(0, 0);
    }

    // Hide the dropdown and font size adjuster after selection
    $('#main-menu-dropdown').removeClass('active');
});




// Handle click on chapter links
$('#main-menu-dropdown').on('click', '.chapter-link', function(event) {
    event.preventDefault(); // Prevent default navigation

    var anchor = $(this).attr('href');
    var $bookItem = $(this).closest('.book-item');
    var filePath = $bookItem.data('file-path');

    // Extract the new book title from the file path
    var newBookTitle = filePath.split('/').pop().replace('_modified.txt', '').trim();

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
    adjustChatboxStyle(); // Ensure this is called as a function

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
    }, 100); // Adjust timeout as necessary

    // Function to proceed with scrolling after images and DOM are ready
    function proceedWithScrolling() {
        var target = $(anchor);
        if (target.length) {
            var offset = target.offset().top; // Get the top offset of the target element

            // If you have a fixed header, adjust the offset by subtracting the header's height
            var headerHeight = $('#your-fixed-header-id').outerHeight() || 0;
            var scrollTo = Math.max(0, offset - headerHeight);

            // **Keep the scrolling method and logic unchanged**
            // Instantly scroll to the calculated position without animation
            window.scrollTo(0, scrollTo);
        } else {
            console.warn('Target anchor not found.');
        }
    }
}

function loadFullText(filePath, callback) {
    // Start the loader animation
    startViewDetailLoaderAnimation();

    $('#full-text').empty().show();
    $('#full-text').append(`
        <div class="acknowledgement-container">
            <p class="acknowledgement">
                Our gratitude to 
                <a href="https://motherandsriaurobindo.in/e-library/" target="_blank">
                    motherandsriaurobindo.in/e-library
                </a> for the texts
            </p>
        </div>
    `);
    $('#full-text').append('<div id="full-text-content" class="full-text-content"></div>');
    
    
    // Since filePath is hardcoded and safe, we can use it directly
    const safeFilePath = filePath; // Use filePath directly


    // Store the current file path
    $('#full-text').data('current-file', filePath);

    const contentLoaded = function() {
        // Stop the loader animation
        stopViewDetailLoaderAnimation();

        // Insert any additional logic if needed after loading
        if (typeof insertOliButtons === 'function') {
            insertOliButtons();
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
        // Web platform - fetch from server
        $.get(serverUrl + '/full-text', { file_path: safeFilePath }, function(data) {
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
// Keyboard accessibility: Close dropdown with Esc key
$(document).on('keydown', function(event) {
    if (event.key === "Escape") { // Check if the pressed key is Esc
        $('#main-menu-dropdown').removeClass('active');
        $('#main-menu-btn').attr('aria-expanded', 'false');
    }
});

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

const chatInput = document.getElementById('chat-input');

// Attach the autoResize function to the input event
chatInput.addEventListener('input', autoResize);

// Initialize the height
autoResize();



// scripts.js

function getClosestPageNumElementFromBottom() {
    // Get all page number elements
    var pageNumElements = document.querySelectorAll('p.pagenum_text');

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
}// Open chatbot click handler
// scripts.js

// Update existing event handlers

// www/static/scripts.js
// scripts.js

function openChatboxSimplified() {
    // Open the chatbox
    $("#chatbox").addClass("open");
    toggleOlierButton();

    // Show necessary buttons
    $("#send-btn").show();
    $("#img-btn").hide();

    // Focus on chat input if appropriate
    const chatInput = document.getElementById("chat-input");
    if (window.innerWidth > 767) {
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    }

    // Adjust chatbox styles
    adjustChatboxStyle();
}


function openChatboxAndAdjustScroll() {
    // **Step 1: Capture the closest page number element from the bottom**
    var pageNumElement = getClosestPageNumElementFromBottom();
    var pageNumElementId = pageNumElement ? pageNumElement.id : null;

    // **Open the chatbox**
    $("#chatbox").addClass("open");
    toggleOlierButton();

    // **Show necessary buttons**
    $("#send-btn").show();
    $("#img-btn").hide();

    // **Focus on chat input if appropriate**
    const chatInput = document.getElementById("chat-input");
    if (window.innerWidth > 767) {
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    }

    // **Adjust chatbox styles**
    adjustChatboxStyle();

    // **After DOM has reflowed, scroll back to the captured element**
// **After DOM has reflowed, scroll back to the captured element**
requestAnimationFrame(function() {
    requestAnimationFrame(function() {
        if (pageNumElementId) {
            // Find the element by ID
            var targetElement = document.getElementById(pageNumElementId);
            if (targetElement) {
                // Scroll to the element
                targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
            } else {
                console.warn('Element with ID not found after opening chatbox:', pageNumElementId);
            }
        } else {
            console.warn('No page number element found before opening chatbox.');
        }
    });
});
}

// scripts.js


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
    const threshold = 10; // Adjust as needed
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= threshold;
}

// Scroll event listener to update auto-scroll flag
messagesContainer.addEventListener('scroll', function() {
    if (checkIfAtBottom()) {
        autoScrollEnabled = true;
    } else {
        autoScrollEnabled = false;
    }
});

// Immediate interaction handlers to disable auto-scroll
['mousedown', 'touchstart', 'wheel'].forEach(eventType => {
    messagesContainer.addEventListener(eventType, function() {
        autoScrollEnabled = false;
    });
});

// Modify scrollToBottom function
function scrollToBottom() {
    if (autoScrollEnabled) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Automatically scroll to the bottom as new messages are added
const observer = new MutationObserver(scrollToBottom);
observer.observe(messagesContainer, { childList: true, subtree: true });



$(document).on('click', '.oli-button', function(event) {
    event.stopPropagation();
    isFirstMessageAfterOliClick = true;
    var fullText = decodeURIComponent($(this).data('full-text'));
    var author = encodeURIComponent($(this).data('author') || 'Unknown Author');
    var chapterTitle = encodeURIComponent($(this).data('chapter-title') || 'Unknown Chapter');
    var bookTitle = encodeURIComponent($(this).data('book-title') || 'Unknown Book');
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    

        // Existing desktop behavior with metadata
        handleOliButtonClick(fullText, decodeURIComponent(author), decodeURIComponent(chapterTitle), decodeURIComponent(bookTitle));
});


// / handleOliButtonClick function


function handleOliButtonClick(fullText, author, chapterTitle, bookTitle) {
    // Set chat input value
    const chatInput = document.getElementById("chat-input");
    chatInput.value = fullText;
    chatInput.dispatchEvent(new Event('input'));

    // Set flags and metadata
    hasImageButtonBeenClicked = false;
    isFirstMessageAfterOliClick = true;
    oliMetadata = {
        author: author,
        chapterTitle: chapterTitle,
        bookTitle: bookTitle
    };

    // Check if the chatbox is already open
    if (!document.getElementById("chatbox").classList.contains("open")) {
        if (isMobile) {
            // Use the simplified function for mobile devices
            openChatboxSimplified();
        } else {
            // Use the original function for non-mobile devices
            openChatboxAndAdjustScroll();
        }
    } else {
        // Adjust chatbox styles
        adjustChatboxStyle();
    }

    // Show the image button
    $("#img-btn").show();
}

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

        // Download Icon
        const downloadIcon = document.createElement('span');
        downloadIcon.classList.add('download-chat', 'fas', 'fa-download');

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

        // Add event listener to download chat on clicking the download icon
        downloadIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            downloadChat(index);
        });

        // Assemble the item
        buttonsContainer.appendChild(downloadIcon);
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

    // Define the file extension based on the platform
    const fileExtension = (platform === 'web') ? '.doc' : '.html';

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
        // **Web Platform Logic**
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
        // **Mobile Platform Logic**
        try {
            // Access Capacitor Plugins inside the mobile logic
            const { Filesystem } = Capacitor.Plugins;
    
            // Check and request permissions (only necessary on Android)
            if (platform === 'android') {
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

            // **Show the empty chat indicator**
            const emptyDiv = document.querySelector("#messages .empty-div");
            emptyDiv.style.display = "flex";

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


// Prevent clicks inside the dropdown from closing it
document.getElementById('chat-history-dropdown').addEventListener('click', function(event) {
    event.stopPropagation();
});


// HANDLE THE SEND-BTN EVENT

$('#send-btn').on('click', sendMessage);


$('#chat-input').on('keypress', function(e) {
        if (e.which === 13) { // 13 is the Enter key code
            e.preventDefault(); // Prevent default Enter key behavior
            sendMessage();
        }
    })

    async function sendMessage() {
    let input_message = $('#chat-input').val();

    if (input_message.trim() === '') {
        alert('Please enter a message');
        return;
    }

    document.querySelector("#messages .empty-div").style.display = "none";

    const messageBox = document.createElement("div");
    messageBox.classList.add("box", "right");

    const message = document.createElement("div");
    message.classList.add("messages");
    message.textContent = input_message;

    messageBox.appendChild(message);
    document.querySelector("#messages .messages-box").appendChild(messageBox);
// Delay to the next repaint cycle

requestAnimationFrame(function() {
    adjustChatboxHeight();
    updateScrollButtonVisibility();
});


    // Clear the input field after the message is added to the chat
    $('#chat-input').val('');
    chatInput.dispatchEvent(new Event('input'));  
    $('#chat-input').focus();

    // Blur the input field to retract the keyboard on mobile devices
    $('#chat-input').blur();

    // Extract and prepare only the last 4 messages in OpenAI format
    const allMessages = [...document.querySelectorAll("#messages .box")].map(el => {
        const messageElement = el.querySelector('.messages');

        // Only process if the .messages element exists
        if (messageElement) {
            const role = el.classList.contains("right") ? "user" : "assistant";
            const content = messageElement.textContent.trim();
            return { role: role, content: content };
        } else {
            console.warn("Warning: .messages element not found inside .box. Ignoring this element.");
            return null;  // Return null to filter out this element
        }
    }).filter(Boolean);  // Filter out any null values

    // Get the last 4 messages (including the latest one)
    let chatHistory = allMessages.slice(-4);

    // Modify the last message with the appropriate preamble
  // Modify the last message with the appropriate preamble
    if (isFirstMessageAfterOliClick && oliMetadata.author && oliMetadata.chapterTitle && oliMetadata.bookTitle) {
        chatHistory[chatHistory.length - 1].content =
            `Olier, please explain the following passage by ${oliMetadata.author}, from the chapter "${oliMetadata.chapterTitle}" of the book "${oliMetadata.bookTitle}" in simple terms: ` +
            chatHistory[chatHistory.length - 1].content;

        // Reset the flag and metadata after use
        isFirstMessageAfterOliClick = false;
        oliMetadata = {
            author: '',
            chapterTitle: '',
            bookTitle: ''
        };

    } else if (isFirstMessageAfterOliClick && dynamicOliMetadata.author && dynamicOliMetadata.chapterTitle && dynamicOliMetadata.bookTitle) {
        chatHistory[chatHistory.length - 1].content =
            `Olier, please explain the following passage by ${dynamicOliMetadata.author}, from the chapter "${dynamicOliMetadata.chapterTitle}" of the book "${dynamicOliMetadata.bookTitle}" in simple terms: ` +
            chatHistory[chatHistory.length - 1].content;

        // Reset the flag and metadata after use
        isFirstMessageAfterOliClick = false;
        dynamicOliMetadata = {
            author: '',
            chapterTitle: '',
            bookTitle: ''
        };
    }

    // Send the chat history as 'messages' to the backend
    try {
        const response = await fetch(serverUrl + '/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'  // Ensure UTF-8 encoding
            },
            body: JSON.stringify({ messages: chatHistory })  // Sending the array of messages
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let responseBox = document.createElement("div");
        responseBox.classList.add("box", "ai-message");
        let responseMessage = document.createElement("div");
        responseMessage.classList.add("messages");
        responseMessage.style.whiteSpace = "pre-wrap";

        // Create a wrapper for the message content
        let messageWrapper = document.createElement("div");
        messageWrapper.style.position = "relative";

        messageWrapper.appendChild(responseMessage);
        responseBox.appendChild(messageWrapper);
        document.querySelector("#messages .messages-box").appendChild(responseBox);

        requestAnimationFrame(function() {
            adjustChatboxHeight();
            updateScrollButtonVisibility();
        });

        
            const md = window.markdownit();
        
            // Streaming function
            let accumulatedText = '';  // To store the accumulated text
        
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Remove loading indicator
                    responseMessage.textContent = '';

                    accumulatedText = accumulatedText.replace(/<\/s>/g, '');
            
        
                    // **Render the final Markdown to HTML and sanitize it**
                    let dirtyHtml = md.render(accumulatedText);
                    let cleanHtml = DOMPurify.sanitize(dirtyHtml);
        
                    // Update the displayed content
                    responseMessage.innerHTML = cleanHtml;
        
                    // Add copy button after streaming is complete
                    addCopyButton(messageWrapper);
        
                    // Ensure the scroll position is updated
                    requestAnimationFrame(function() {
                        updateScrollButtonVisibility();
                    });
                    break;
                }
        
                let chunk = decoder.decode(value);
                // chunk = chunk.replace(/<\/s>/g, '');
                accumulatedText += chunk;
        
                // **Incrementally parse and render the accumulated text**
                let dirtyHtml = md.render(accumulatedText);
                let cleanHtml = DOMPurify.sanitize(dirtyHtml);
        
                // Update the displayed content
                responseMessage.innerHTML = cleanHtml;
        
                // Ensure the scroll position is updated
                requestAnimationFrame(function() {
                    updateScrollButtonVisibility();
                });
            }
        
    
        

        // Function to add copy button

        // Function to remove all existing copy buttons
        function removeAllCopyButtons() {
            document.querySelectorAll('.copy-button').forEach(button => button.remove());
        }

// Function to add copy button
function addCopyButton(wrapper) {
    removeAllCopyButtons();
    let copyButton = document.createElement("button");
    copyButton.innerHTML = '<div class="copy-icon"></div>';
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
        const lastTwoMessages = Array.from(allMessages).slice(-2);
        let textToCopyPlain = "";
        let textToCopyHTML = "";

        lastTwoMessages.forEach((messageBox, index) => {
            const messageElement = messageBox.querySelector('.messages');
            if (messageElement) {
                const role = messageBox.classList.contains("right") ? "User" : "Olier";
                const contentPlain = messageElement.textContent.trim();
                const contentHTML = messageElement.innerHTML.trim();

                textToCopyPlain += `${role}: ${contentPlain}\n\n`;

                // Wrap the HTML content with role information
                textToCopyHTML += `<p><strong>${role}:</strong></p>${contentHTML}<br>`;
            }
        });

        if (textToCopyPlain && textToCopyHTML) {
            const clipboardItem = new ClipboardItem({
                "text/plain": new Blob([textToCopyPlain], { type: "text/plain" }),
                "text/html": new Blob([textToCopyHTML], { type: "text/html" })
            });

            navigator.clipboard.write([clipboardItem]).then(() => {
                if (!isMobile) {
                    alert("Last two messages copied to clipboard!");
                }
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                if (!isMobile) {
                    alert("Failed to copy text.");
                }
            });
        } else {
            if (!isMobile) {
                alert("No messages to copy.");
            }
        }
    });

    wrapper.appendChild(copyButton);
}

        // Hide the image button after sending the message
        $("#img-btn").hide();
        $("#send-btn").show();

    } catch (error) {
        // Log the actual error to the console
        console.error('Error in sendMessage:', error);

        // Optionally, display the error message to the user
        alert(`An error occurred: ${error.message}`);

        // Clear the input field
        document.getElementById("chat-input").value = "";

        // Hide buttons if an error occurs
        $("#img-btn").hide();
        $("#send-btn").hide();
    }
}

// Handle the image button click event

$('#img-btn').on('click', async function() {
    const input_message = $('#chat-input').val();

    if (input_message.trim() === '') {
        alert('Please enter a message');
        return;
    }

    document.querySelector("#messages .empty-div").style.display = "none";

    const messageBox = document.createElement("div");
    messageBox.classList.add("box", "right");

    const message = document.createElement("div");
    message.classList.add("messages");
    message.textContent = input_message;

    messageBox.appendChild(message);
    document.querySelector("#messages .messages-box").appendChild(messageBox);

    requestAnimationFrame(function() {
        adjustChatboxHeight();
        updateScrollButtonVisibility();
    });

    
    // Clear the input field after the message is added to the chat
    $('#chat-input').val('');
    chatInput.dispatchEvent(new Event('input')); 

    try {
        // Step 1: Generate and stream the artistic description
        const response = await fetch(serverUrl + '/generate-description', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: input_message })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let responseBox = document.createElement("div");
        responseBox.classList.add("box", "ai-message");
        let responseMessage = document.createElement("div");
        responseMessage.classList.add("messages");
        responseMessage.style.whiteSpace = "pre-wrap";

        // Create a wrapper for the message content
        let messageWrapper = document.createElement("div");
        messageWrapper.style.position = "relative";

        messageWrapper.appendChild(responseMessage);
        responseBox.appendChild(messageWrapper);
        document.querySelector("#messages .messages-box").appendChild(responseBox);

        requestAnimationFrame(function() {
            adjustChatboxHeight();
            updateScrollButtonVisibility();
        });

 // Streaming function
let accumulatedText = '';  // To store the accumulated text

while (true) {
    const { done, value } = await reader.read();
    if (done) {
        // Add copy button after streaming is complete
        addCopyButton(messageWrapper);
        break;
    }

    let chunk = decoder.decode(value);

    accumulatedText += chunk;

    // Update the displayed text
    responseMessage.innerHTML = accumulatedText;
}

function addSaveImageButton(container, imageUrl) {
    // Create the save/download button
    let saveButton = document.createElement("button");
    saveButton.innerHTML = '<i class="fas fa-download"></i>'; // Use a download icon
    saveButton.classList.add("save-image-button"); // Apply the CSS class

    saveButton.addEventListener("click", function() {
        saveImage(imageUrl);
    });

    // Append the save button to the container after the image
    container.appendChild(saveButton);



    async function saveImage(imageUrl) {
        const platform = (typeof Capacitor !== 'undefined') ? Capacitor.getPlatform() : 'web';
    
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
    
        // Generate a unique filename
        const fileName = `Olier_artwork_${timestamp}.png`;
    
        try {
            // Fetch the image as a blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();
    
            if (platform === 'web') {
                // **Web Platform Logic**
                const url = URL.createObjectURL(blob);
    
                // Create a temporary link to trigger the download
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
    
                // Clean up
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
    
                alert(`Image saved successfully as ${fileName}.`);
    
            } else {
                // **Mobile Platform Logic**
                const { Filesystem } = Capacitor.Plugins;
    
                // Check and request permissions (only necessary on Android)
                if (platform === 'android') {
                    let permission = await Filesystem.checkPermissions();
                    if (permission.publicStorage !== 'granted') {
                        permission = await Filesystem.requestPermissions();
                        if (permission.publicStorage !== 'granted') {
                            alert('Permission to access storage was denied.');
                            return;
                        }
                    }
                }
    
                // Convert blob to base64 data
                const reader = new FileReader();
                reader.onloadend = async function() {
                    const base64data = reader.result.split(',')[1]; // Remove data URL prefix
    
                    // **Save the file using 'DOCUMENTS' directory**
                    await Filesystem.writeFile({
                        path: fileName,
                        data: base64data,
                        directory: 'DOCUMENTS', // Use string literal instead of FilesystemDirectory.Documents
                        // Remove the 'encoding' option to write binary data
                        recursive: true
                    });
    
                    alert(`Image saved successfully as ${fileName} in Documents.`);
                };
    
                reader.readAsDataURL(blob);
            }
        } catch (error) {
            console.error('Error saving image:', error);
            alert('Failed to save image.');
        }
    }
}

 
       // Function to remove all existing copy buttons
        function removeAllCopyButtons() {
            document.querySelectorAll('.copy-button').forEach(button => button.remove());
        }

        // Function to add copy button
        function addCopyButton(wrapper) {
            removeAllCopyButtons();
            let copyButton = document.createElement("button");
            copyButton.innerHTML = '<div class="copy-icon"></div>';
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
                const lastTwoMessages = Array.from(allMessages).slice(-2);
                let textToCopy = "";

                lastTwoMessages.forEach((messageBox, index) => {
                    const messageElement = messageBox.querySelector('.messages');
                    if (messageElement) {
                        const role = messageBox.classList.contains("right") ? "User" : "Olier";
                        const content = messageElement.textContent.trim();
                        textToCopy += `${role}: ${content}\n\n`;
                    }
                });

                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy.trim()).then(() => {
                        alert("Last two messages copied to clipboard!");
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                } else {
                    alert("No messages to copy.");
                }
            });

            wrapper.appendChild(copyButton);
        }

        // After description is generated, add the "Image Generating..." message
        let loadingBox = document.createElement("div");
        loadingBox.classList.add("box");
        let loadingMessage = document.createElement("div");
        loadingMessage.classList.add("messages", "loading-message");
        loadingMessage.textContent = "Image Generating";
        loadingBox.appendChild(loadingMessage);
        document.querySelector("#messages .messages-box").appendChild(loadingBox);

        // Animate the loading message
        let dots = 0;
        const loadingInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            loadingMessage.textContent = "Image Generating" + ".".repeat(dots);
        }, 500);

        // Step 2: Generate the image using the fully streamed artistic description
        const imageResponse = await $.ajax({
            url: serverUrl + '/generate-flux-image',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ prompt: accumulatedText }),  // Change 'description' to 'prompt'
            dataType: 'json'
        });

        // Clear the loading interval and remove the loading message
        clearInterval(loadingInterval);
        loadingBox.remove();

            // **Adjust chatbox height after removing loading message**
            requestAnimationFrame(function() {
                adjustChatboxHeight();
                updateScrollButtonVisibility();
            });

// Create a new box for the image(s)
let imageBox = document.createElement("div");
imageBox.classList.add("box");
let imageMessage = document.createElement("div");
imageMessage.classList.add("messages");
imageBox.appendChild(imageMessage);

// Handle potentially multiple images
imageResponse.images.forEach(image => {
    // Create a container for the image and button
    let imageContainer = document.createElement("div");
    imageContainer.style.display = "inline-block"; // Keep the image and button together
    imageContainer.style.marginTop = "10px"; // Add space between images

    // Create the image element
    const img = document.createElement("img");
    img.src = image.url;
    img.alt = "Generated Flux Artwork";
    img.style.maxWidth = "100%";
    img.style.display = "block"; // Ensure it occupies full width of the container

    // Append the image to the container
    imageContainer.appendChild(img);

    // **Wait for the image to load before adding the button**
    img.onload = function() {
        // Add the save image button after the image
        addSaveImageButton(imageContainer, image.url);
    };

    // Optionally, handle image loading errors
    img.onerror = function() {
        console.error('Error loading image:', image.url);
        // You can display an error message or placeholder image here
    };

    // Append the container to your imageMessage container
    imageMessage.appendChild(imageContainer);
});

document.querySelector("#messages .messages-box").appendChild(imageBox);

// Focus on the input box after image generation
const chatInput = document.getElementById("chat-input");
chatInput.focus();
chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);

// Hide the image button after generating the image
$("#img-btn").hide();
$("#send-btn").show();
    } catch (error) {
        let errorMessage = 'An error occurred while generating the image.';
        if (error.responseJSON && error.responseJSON.error) {
            errorMessage = error.responseJSON.error;
        }
        alert(errorMessage);

        document.getElementById("chat-input").value = "";

        // Hide buttons if an error occurs
        $("#img-btn").hide();
        $("#send-btn").hide();
    }
});
    
        
//  Show Search Results  

    $("#loader-container").hide();
    $('#full-text').hide();

    // Add this new code for the search box functionality
    $('#query').on('focus', function() {
        $(this).select();
    }).on('mouseup', function(e) {
        e.preventDefault();
        e.stopPropagation(); // Stop the event from bubbling up
    });
    // Apply custom styles for the selection
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



    let fadeInterval;
    function startLoaderAnimation() {
        $("#loader-container").css({
            'display': 'flex',
            'justify-content': 'center',
            'align-items': 'center',
            'margin-top': '20px'
        });
        $(".book-loader").css({
            'font-size': '36px',
            'color': '#228B22', 
            'opacity': 1
        });
        let opacity = 1;
        fadeInterval = setInterval(function() {
            opacity = opacity > 0.6 ? 0.6 : 1;
            $(".book-loader").animate({ 'opacity': opacity }, 600, 'linear'); // Faster transition
        }, 700); // Shorter interval for faster fading
    }
    function stopLoaderAnimation() {
        clearInterval(fadeInterval);
        $("#loader-container").hide();
    }


    // Handle clicks on sample questions
    $('.sample-question').click(function(e) {
        e.preventDefault(); // Prevent default link behavior

        var questionText = $(this).text();
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

    // Add hidden class to open_chatbot button when not in flex-box and zoom_to_top button
    $('.open_chatbot:not(.in-flex-box), .zoom_to_top').addClass('hidden');




    // Determine the search mode and set the appropriate URL
    var isVectorSearch = !$searchToggle.is(':checked');
    var searchUrl = isVectorSearch ? serverUrl + '/search' : serverUrl + '/keyword-search';
    console.log("Search URL:", searchUrl);

    $.post(searchUrl, { query: query }, function(data) {
        console.log("Search results received", data);
        stopLoaderAnimation();

        // If no results are found, show a message and re-display sample questions
        if (data.length === 0) {
            $('#results').html('<p>No results found. Please try a different query.</p>');
            $('.sample-questions').show();
            return;
        }

        var $resultsContainer = $('<div id="top-results"></div>');

        data.forEach(function(result, index) {
            // Use highlighted_text for preview, fallback to text if not available
            var preview = result.highlighted_text || result.text;
            preview = preview.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

            // Truncate the preview to approximately 100 words, preserving HTML tags
            var previewWords = preview.split(" ");
            if (previewWords.length > 100) {
                preview = previewWords.slice(0, 100).join(" ") + "...";
            }

            // Conditionally display the relevance score only for vector search
            var relevanceScoreHtml = '';
            if (isVectorSearch && result.relevance_score !== undefined) {
                relevanceScoreHtml = `
                    <div class="result-score">
                        Relevance Score: ${result.relevance_score.toFixed(2)}
                    </div>
                `;
            }

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

    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.log("Search request failed", textStatus, errorThrown);
        stopLoaderAnimation();
        $('#results').prepend('<p>An error occurred while searching. Please try again.</p>');
        // Show sample questions again if there was an error
        $('.sample-questions').show();
    });
});
    // Show sample questions if the search input is cleared
    $('#query').on('input', function() {
        if ($(this).val().trim() === '') {
            $('#results').empty();
            $('.sample-questions').show();
        }
    });

// Function to insert dynamic Oli buttons into each content_para paragraph and normal-para and pseudo--content_para
function insertOliButtons() {
    const contentParas = $('#full-text-content').find('p');

    contentParas.each(function(index, element) {
        const para = $(element);
        const classes = para.attr('class') ? para.attr('class').split(' ') : [];

        if (classes.includes('content_para') || classes.includes('normal-para')) {
            // Initialize an array to collect related paragraphs
            let paragraphsToCombine = [para];
            let lastBqPara = null;
            let lastEmContent = null;

            // Check for preceding paragraphs (bq-para, em--content_para, singleline--content_para)
            let prevElement = para.prev();
            while (prevElement.length) {
                const prevClasses = prevElement.attr('class') ? prevElement.attr('class').split(' ') : [];
                if (
                    prevClasses.includes('bq-para') ||
                    prevClasses.includes('em--content_para') ||
                    prevClasses.includes('singleline--content_para')
                ) {
                    paragraphsToCombine.unshift(prevElement);
                } else {
                    break;
                }
                prevElement = prevElement.prev();
            }

            // **Modified Next Element Selection**
            let nextElement = para.nextAll('p').first();
            while (nextElement.length) {
                const nextClasses = nextElement.attr('class') ? nextElement.attr('class').split(' ') : [];
                if (nextClasses.includes('pseudo--content_para')) {
                    paragraphsToCombine.push(nextElement);
                    // Insert the Oli button at the end of the pseudo--content_para
                    insertOliButton(nextElement, paragraphsToCombine);
                    return; // Continue to the next iteration
                } else if (nextClasses.includes('pagenum_text')) {
                    // Skip page number paragraphs
                    nextElement = nextElement.nextAll('p').first();
                } else {
                    break;
                }
            }

            // If no pseudo--content_para, insert the Oli button at the end of the current paragraph
            insertOliButton(para, paragraphsToCombine);
        }
    });
}

function insertOliButton(targetPara, paragraphsToCombine) {
    // Extract metadata from the target paragraph
    const author = targetPara.attr('data-author') || 'Unknown Author';
    const bookTitle = targetPara.attr('data-book-title') || 'Unknown Book';
    const chapterTitle = targetPara.attr('data-chapter-title') || 'Unknown Chapter';
    const searchId = targetPara.attr('search_id') || '';

    // Combine the text content from all related paragraphs
    let fullText = '';
    paragraphsToCombine.forEach(function(p) {
        let text = p.text().trim();
        text = text.replace(/\s+/g, ' '); // Remove unnecessary spaces
        fullText += text + '\n\n';
    });
    fullText = fullText.trim();

    // Create the Oli button without inline CSS
    const oliButton = $('<button>', {
        class: 'oli-button oli-button-paragraph',
        text: 'O!',
        attr: {
            'data-full-text': encodeURIComponent(fullText),
            'data-author': author,
            'data-book-title': bookTitle,
            'data-chapter-title': chapterTitle,
            'data-search-id': searchId
        }
    });

    // Create a wrapper <span> to reset font-size
    const buttonWrapper = $('<span>', {
        class: 'oli-button-wrapper'
    }).css({
        'font-size': 'initial' /* Reset font size inheritance */
    });

    // Append the button to the wrapper
    buttonWrapper.append(oliButton);
    
    // Append the wrapper to the target paragraph
    targetPara.append(buttonWrapper);
}

// Event handler for dynamic Oli buttons
$(document).on('click', '.oli-button-paragraph', function(event) {
    event.stopPropagation(); 
    const oliButton = $(this);

    // Extract data attributes from the button
    const fullText = decodeURIComponent(oliButton.attr('data-full-text'));
    const author = oliButton.attr('data-author');
    const chapterTitle = oliButton.attr('data-chapter-title');
    const bookTitle = oliButton.attr('data-book-title');

        handleDynamicOliButtonClick(fullText, author, chapterTitle, bookTitle);

});

// www/static/scripts.js


function handleDynamicOliButtonClick(fullText, author, chapterTitle, bookTitle) {
    // Set chat input value
    const chatInput = document.getElementById("chat-input");
    chatInput.value = fullText;
    chatInput.dispatchEvent(new Event('input'));

    // Set flags and metadata
    hasImageButtonBeenClicked = false;
    isFirstMessageAfterOliClick = true;
    dynamicOliMetadata = {
        author: author,
        chapterTitle: chapterTitle,
        bookTitle: bookTitle
    };

    // Check if the chatbox is already open
    if (!document.getElementById("chatbox").classList.contains("open")) {
        if (isMobile) {
            // Use the simplified function for mobile devices
            openChatboxSimplified();
        } else {
            // Use the original function for non-mobile devices
            openChatboxAndAdjustScroll();
        }
    } else {
        // Adjust chatbox styles
        adjustChatboxStyle();
    }

    // Show the image button
    $("#img-btn").show();
}

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





// scripts.js

$(document).on('click', '.view-detail-link', function(e) {
    e.preventDefault();
    e.stopPropagation();
    applyReadingMode();

    var id = $(this).data('id');
    var originalFilePath = $(this).data('file-path');
    var bookTitle = $(this).data('book-title'); // Retrieve the book title

    // Update current book and chapter titles
    currentBookTitle = bookTitle;
    currentChapterTitle = ''; // Reset chapter title

    // Update the flex box center content
    updateFlexBoxCenterContent(currentBookTitle, currentChapterTitle);

    let adjustedFilePath = originalFilePath; // Default to original path

    if (!isWeb) {
        // We're on the mobile app; adjust the filePath

        // Extract the file name from the server's absolute path
        let fileName = originalFilePath;
        if (fileName.includes('/')) {
            fileName = fileName.substring(fileName.lastIndexOf('/') + 1);
        }

        // Construct the relative path to the file within the app's assets
        adjustedFilePath = `static/HTML/${fileName}`;
    }

    // Now proceed to use adjustedFilePath accordingly

    // Start the View Detail loader animation
    startViewDetailLoaderAnimation();

    // Clear and show the full-text container
    $('#full-text').empty().show();
    $('#full-text').append(`
        <div class="acknowledgement-container" style="display: flex; justify-content: center; align-items: center; font-size: 12px; margin: 10px 0;">
            <p class="acknowledgement" style="margin: 0;">
                Our gratitude to <a href="https://motherandsriaurobindo.in/e-library/" target="_blank" style="color: #007bff; text-decoration: none;">
                    motherandsriaurobindo.in/e-library
                </a> for the texts
            </p>
        </div>
    `);
    $('#full-text').append('<div id="full-text-content" class="full-text-content"></div>');


// scripts.js

const contentLoaded = function() {
    // Stop the loader animation
    stopViewDetailLoaderAnimation();
    
    // Call onContentLoaded if needed
    requestAnimationFrame(function() {
        onContentLoaded();
    });

    // Insert any additional logic if needed after loading
    if (typeof insertOliButtons === 'function') {
        insertOliButtons();
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
        // Stop the loader animation
        stopViewDetailLoaderAnimation();

        $('#full-text-content').html('<p>An error occurred while loading the content.</p>');
        console.error('Error loading full text:', jqXHR.status, textStatus, errorThrown);
    };

    if (isWeb) {
        // Web platform - fetch from server using the adjustedFilePath
        $.get(serverUrl + '/full-text', { file_path: adjustedFilePath }, function(data) {
            $('#full-text-content').html(data);
            contentLoaded();
        }).fail(contentLoadFailed);
    } else {
        // Mobile app - load from local assets using the adjustedFilePath
        const localFilePath = adjustedFilePath;

        // Debugging: Log the local file path
        console.log('Attempting to load local file:', localFilePath);

        $.get(localFilePath, function(data) {
            $('#full-text-content').html(data);
            contentLoaded();
        }).fail(contentLoadFailed);
    }
});
});

    


    