function handleFootnotes() {
    const $footnoteRefs = $('.fn-ref');

    $footnoteRefs.each(function() {
        const $ref = $(this);

        // Create a unique ID for the footnote popup
        const popupId = 'footnote-popup-' + $ref.data('fn');

        // Create a container for the footnote popup if it doesn't exist
        let $popup = $('#' + popupId);
        if ($popup.length === 0) {
            $popup = $('<div class="footnote-popup" id="' + popupId + '"></div>').appendTo('body');
        }

        const fnId = 'fn-' + $ref.data('fn');
        const $footnoteContentElement = $('#' + fnId);

        if ($footnoteContentElement.length) {
            const footnoteContent = $footnoteContentElement.html();

            // Event handlers
            $ref.on('mouseenter click', function(event) {
                event.preventDefault();
                event.stopPropagation();

                // Toggle active state on click
                if (event.type === 'click') {
                    const isActive = $ref.hasClass('active');
                    $ref.toggleClass('active', !isActive);
                }

                // Position the popup near the footnote reference
                const refOffset = $ref.offset();
                const refHeight = $ref.outerHeight();

                $popup.html(footnoteContent);
                $popup.css({
                    top: refOffset.top + refHeight + 5, // Adjust the vertical position
                    left: refOffset.left,
                    display: 'block'
                });
            });

            $ref.on('mouseleave', function() {
                if (!$ref.hasClass('active')) {
                    $popup.hide();
                }
            });

            // Prevent clicks inside the popup from closing it
            $popup.on('click', function(event) {
                event.stopPropagation();
            });
        } else {
            console.warn('Footnote content not found for', fnId);
        }
    });

    // Hide all active footnotes when clicking outside
    $(document).on('click', function() {
        $('.footnote-popup').hide();
        $('.fn-ref').removeClass('active');
    });
}

// Call the function to handle footnotes
$(document).ready(function() {
    handleFootnotes();
});