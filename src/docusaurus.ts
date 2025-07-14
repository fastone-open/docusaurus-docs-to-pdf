/**
 * Expands all collapsible items in a Docusaurus sidebar.
 * This function is designed to be executed within the browser context (e.g., via `page.evaluate()`).
 * It iteratively finds and clicks "expand" buttons/links until all sublist items and category items are open.
 *
 * Docusaurus sidebars typically use two types of expandable elements:
 * 1. `<a>` tags with specific classes/roles for non-category sublists (e.g., "Guides", "Concepts").
 * 2. `<button>` tags for category items (e.g., a documentation section that expands to show its sub-pages).
 *
 * A small delay is introduced after each click batch to allow the DOM to update and animations to complete.
 *
 * @returns {Promise<void>} A Promise that resolves when all expandable sidebar items have been clicked.
 */
export async function expandDocusaurusSidebar() {
    // Log for clarity that the expansion process is starting.
    console.log('[expandDocusaurusSidebar] Starting sidebar expansion...');
    
    async function doExpand(ul) {
        for (let li of ul.querySelectorAll(':scope > li')) {
            console.log('[expandDocusaurusSidebar] Found sidebar item:', li);
            const div = li.querySelector(':scope>div[class*="menu__list-item-collapsible"]')
            if (div) {
                console.log("found div", div)
                const a = div.querySelector(':scope>a[aria-expanded="false"]')
                if (a) {
                    a.click();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                const button = div.querySelector(':scope>button[aria-expanded="false"]')
                if (button) {
                    button.click();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                const subUl = li.querySelector(':scope>ul[class*="menu__list"]')
                if (subUl) {
                    console.log('[expandDocusaurusSidebar] Found sublist:', subUl);
                    await doExpand(subUl);
                }
            }
        }
    }
    
    await doExpand(document.querySelector('div[class*="navbar-sidebar__items"]>div[class*="navbar-sidebar__item"]:nth-of-type(2)>ul[class*="menu__list"]'))
    console.log('[expandDocusaurusSidebar] Sidebar expansion finished successfully.');
}

export async function replaceBodyInnerHtml(innerHtml: string) {
    document.body.innerHTML = innerHtml;
}


/**
 * Extracts a hierarchical structure of sidebar items from a Docusaurus documentation page's DOM.
 * This function is designed to be executed within the browser context (e.g., via `page.evaluate()`).
 * It traverses the Docusaurus sidebar's HTML structure, identifies document links and categories,
 * and recursively builds a nested array of objects representing the sidebar's content.
 *
 * Each extracted item is assigned a unique, valid HTML ID, which is essential for
 * generating internal links (e.g., in a Table of Contents) in the final PDF document.
 * All helper functions like `generateValidHtmlId` are defined strictly within this function's scope.
 *
 * @returns {Promise<Array<Object>>} A Promise that resolves to a nested array of objects,
 * where each object represents a sidebar item with properties like `id`, `title`, `url`, `path`, and `children`.
 */
export async function extractDocusaurusSidebarItems() {
    
    /**
     * Generates a unique and valid HTML ID string.
     * This ID is constructed by combining a timestamp part and a random alphanumeric part,
     * prefixed with 'id-' to ensure it starts with a letter, making it a valid CSS selector.
     * This helps in creating unique anchors for generated Table of Contents links.
     *
     * @returns {string} A unique HTML ID string (e.g., "id-12345abcdef").
     */
    function generateValidHtmlId() {
        const randomPart = Math.random().toString(36).substring(2); // Generates an alphanumeric string
        const timestampPart = Date.now().toString().substring(5); // Uses part of the current timestamp for uniqueness
        return `id-${timestampPart}${randomPart}`; // Prefixes with 'id-' to ensure it starts with a letter
    }
    
    /**
     * Recursively parses Docusaurus sidebar list items (<li> elements)
     * and constructs a hierarchical array of sidebar item objects.
     * It identifies links, titles, URLs, and nested lists to build the structure.
     *
     * @param {Array<HTMLElement>} lis An array of `<li>` HTML elements representing sidebar list items at the current level.
     * @returns {Array<Object>} An array of parsed sidebar item objects.
     */
    const parseListItems = (lis) => {
        const sidebarItems = []; // Accumulator for parsed items at this level
        
        for (const li of lis) {
            // Attempt to find the direct link/button within the current <li>.
            // This selector targets both collapsible category links and direct document links.
            const a = li.querySelector(
                ':scope > .menu__list-item-collapsible > a, :scope > a.menu__link'
            );
            
            // If no valid anchor element is found within this list item, skip it.
            // This handles cases where an <li> might be a mere container without a direct link.
            if (!a) {
                console.warn('[extractSidebarItems] Skipped <li> element due to missing expected anchor/link:', li.outerHTML);
                continue;
            }
            
            // Check for nested unordered lists (sub-menus), which typically indicate a category.
            const subList = li.querySelector(':scope > ul.menu__list');
            let children = [];
            
            // If a sublist exists, recursively parse its children to build the hierarchy.
            if (subList) {
                // Convert HTMLCollection to a standard Array before passing to recursive call
                children = parseListItems(Array.from(subList.children));
            }
            
            // Push the extracted item's details into the current level's sidebarItems array.
            sidebarItems.push({
                id: generateValidHtmlId(), // Assign a newly generated unique ID for this item
                title: (a.textContent && a.textContent.trim()) || '', // Extract and trim the visible text title, handling null
                path: a.getAttribute('href') || '', // Get the href attribute as the internal path
                url: a.href || '', // Get the full absolute URL resolved by the browser for navigation
                children: children, // Include any recursively parsed child items
            });
        }
        return sidebarItems;
    };
    
    // Start the parsing process by selecting all top-level list items
    // within the main Docusaurus sidebar menu.
    const topLevelListItems = document.querySelectorAll('ul.theme-doc-sidebar-menu > li');
    
    console.log(`[extractSidebarItems] Found ${topLevelListItems.length} top-level sidebar items.`);
    
    // Convert the NodeListOf<Element> returned by querySelectorAll to a standard Array
    // before passing it to the `parseListItems` function to begin the recursive parsing.
    return parseListItems(Array.from(topLevelListItems));
}

/**
 * Updates the `id` attribute of a specific HTML element in the DOM.
 * This function is designed to run within the browser's context via `page.evaluate()`.
 * It's particularly useful for ensuring that elements have unique and predictable IDs
 * for referencing them later (e.g., in a Table of Contents or internal links).
 *
 * @param selector The CSS selector string used to locate the target HTML element.
 * This should ideally be a unique selector like an existing ID.
 * @param newId The new ID string to be assigned to the found element. This ID
 * should be unique across the entire document.
 * @returns {Promise<void>} A Promise that resolves when the ID has been updated.
 * Note: This function will throw an error if the element
 * is not found, due to the non-null assertion operator `!`.
 */
export async function updateElementId(selector: string, newId: string): Promise<void> {
    // Select the first element matching the given CSS selector.
    // The '!' (non-null assertion operator) is used here, implying that the element
    // is expected to exist. If it doesn't, a runtime error will occur.
    const element = document.querySelector(selector)!;
    // Assign the new ID to the found element.
    element.id = newId;
}

/**
 * Retrieves the `outerHTML` of a specified HTML element in the DOM
 * and applies a `page-break-after` style for PDF generation.
 * This function is intended to be executed within the browser's context via `page.evaluate()`.
 * It's commonly used to extract the full HTML content of a section or page
 * that will be later merged into a larger document for PDF conversion.
 *
 * @param selector The CSS selector string used to locate the target HTML element.
 * @returns {Promise<string>} A Promise that resolves with the `outerHTML` string of the
 * found element. If the element is not found, an empty string is returned.
 * The element will also have `page-break-after: always` applied to its style.
 */
export async function getElementOuterHtml(selector: string): Promise<string> {
    // Select the first element matching the given CSS selector.
    const element: HTMLElement | null = document.querySelector(selector);
    
    if (element) {
        // Apply CSS style to force a page break *after* this element in the generated PDF.
        // This is crucial for ensuring each extracted document content block starts on a new page.
        element.style.pageBreakAfter = 'always';
        
        // Return the outer HTML (including the element itself and its content).
        return element.outerHTML;
    } else {
        // If the element is not found, return an empty string to avoid errors
        // and allow the PDF generation process to continue.
        console.warn(`[getElementOuterHtml] Element with selector "${selector}" not found.`);
        return '';
    }
}


/**
 * Rewrites the `href` attributes of internal links within the current document's DOM.
 * This function is designed to be executed within the browser's context via `page.evaluate()`.
 * It's particularly useful when merging multiple HTML pages into a single PDF,
 * as it converts original relative/absolute URLs (e.g., `/docs/my-page`) into
 * anchor links (e.g., `#my-page-id`) that point to elements within the merged document.
 *
 * @param pathToAnchors An array of tuples, where each tuple contains:
 * - `string`: The original path or href of a link (e.g., '/docs/introduction').
 * - `string`: The corresponding target anchor ID within the merged document
 * (e.g., 'id-timestamp-random').
 * @returns {Promise<void>} A Promise that resolves when all matching links have been rewritten.
 */
export async function rewriteLinks(pathToAnchors: [string, string][]): Promise<void> {
    // Select all <a> elements that have an 'href' attribute.
    // Cast to HTMLAnchorElement for proper TypeScript type inference and access to link-specific properties.
    const allLinks = document.querySelectorAll('a[href]');
    
    for (let i = 0; i < allLinks.length; i++) {
        const element = allLinks[i] as HTMLAnchorElement;
        // Get the value of the 'href' attribute.
        let linkPath = element.getAttribute('href') || '';
        
        // Iterate through the provided map of original paths to new anchor IDs.
        for (let j = 0; j < pathToAnchors.length; j++) {
            const [path, anchor] = pathToAnchors[j];
            // If the current link's href matches an original path in the map,
            // rewrite its href to point to the new anchor ID.
            if (linkPath === path) {
                element.setAttribute('href', '#' + anchor);
                // Break inner loop as we found a match for this link
                break;
            }
        }
    }
}

/**
 * Expands all HTML `<details>` elements that are currently collapsed (i.e., `data-collapsed="true"`).
 * This function is intended to be executed within the browser's context via `page.evaluate()`.
 * It simulates a user clicking on the `<summary>` element within each collapsed `<details>`
 * to reveal its content. This is useful for ensuring all content is visible in the PDF.
 *
 * @returns {Promise<void>} A Promise that resolves after all matching details elements have been clicked.
 */
export async function expandDetails() {
    // Select all <details> elements that have the custom attribute data-collapsed="true".
    // Docusaurus (and similar frameworks) often use this to manage collapse/expand states.
    const details = document.querySelectorAll('details[data-collapsed="true"]');
    
    console.log(`[expandDetails] Found ${details.length} collapsed details elements to expand.`);
    
    // Iterate over each found collapsed details element.
    details.forEach(it => {
        // Find the <summary> element directly within the current <details> element.
        // The 'summary' element is typically the clickable part that toggles the details.
        const summaryElement = it.querySelector('summary');
        // If a summary element is found, simulate a click on it to expand the details.
        if (summaryElement) {
            summaryElement.click();
        } else {
            console.warn('[expandDetails] No <summary> element found for a collapsed <details>:', it.outerHTML);
        }
    });
    
    console.log('[expandDetails] Finished attempting to expand all details elements.');
}

/**
 * Removes specified HTML elements from the DOM based on a list of CSS selectors.
 * This function is intended to be executed within the browser's context via `page.evaluate()`.
 * It's useful for cleaning up the page before PDF generation by removing
 * elements that are not desired in the final PDF (e.g., navigation bars, footers,
 * interactive components, or other UI elements).
 *
 * @param selectors An array of CSS selector strings. All elements matching any of these
 * selectors will be removed from the document.
 * @returns {Promise<void>} A Promise that resolves after all elements matching the
 * provided selectors have been removed.
 */
export async function removeElements(selectors: string[]) {
    console.log(`[removeElements] Starting to remove elements matching selectors: ${selectors.join(', ')}`);
    for (let selector of selectors) {
        // Select all elements matching the current selector.
        const elementsToRemove = document.querySelectorAll(selector);
        let removedCount = 0;
        // Iterate over the found elements and remove each one from its parent.
        elementsToRemove.forEach(it => {
            it.remove(); // The .remove() method directly removes the element from the DOM.
            removedCount++;
        });
        if (removedCount > 0) {
            console.log(`[removeElements] Removed ${removedCount} elements for selector: "${selector}".`);
        } else {
            console.log(`[removeElements] No elements found for selector: "${selector}".`);
        }
    }
    console.log('[removeElements] Element removal finished.');
}

/**
 * Removes the 'loading="lazy"' attribute from all <img> elements in the document.
 * This forces browsers to load images immediately rather than lazily, which is
 * useful for capturing all image content when generating PDFs or screenshots.
 *
 * This function is intended to be executed within a browser context (e.g., via Puppeteer's `page.evaluate()`).
 *
 * @returns {Promise<void>} A Promise that resolves once all applicable 'loading' attributes have been removed.
 * The function uses an async wrapper but performs synchronous DOM manipulation.
 */
export async function removeLazyLoading() {
    // Log the start of the operation for debugging purposes.
    console.log('[DOM Modifier] Starting to remove "loading=lazy" attributes from images.');
    
    // Select all <img> elements that have the 'loading' attribute set to 'lazy'.
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    
    // Iterate over each found lazy image element.
    lazyImages.forEach(img => {
        // Remove the 'loading' attribute. This instructs the browser to load the image immediately.
        img.removeAttribute('loading');
    });
    
    // Log the completion of the operation, indicating how many images were affected.
    console.log(`[DOM Modifier] Removed "loading=lazy" from ${lazyImages.length} images.`);
    
    // As this function modifies the DOM synchronously, the Promise resolves immediately after the loop.
    // The `async` keyword and `Promise<void>` return type are kept for consistency with other Puppeteer evaluate functions.
}