import {SidebarItem} from "./type";

/**
 * Generates an HTML string for a Table of Contents (TOC) based on a
 * hierarchical sidebar structure. The generated TOC aims to mimic Docusaurus's
 * styling, including specific link colors, indentation, and differentiation
 * between directory (category) and document (page) entries.
 *
 * The output HTML includes an embedded <style> block with CSS rules
 * to control the appearance of the TOC, including font sizes, colors,
 * spacing, and optional icons for directory items.
 *
 * @param sidebarItems An array of `SidebarItem` objects, potentially nested,
 * representing the structure of the documentation. Each item
 * should at least have `id`, `title`, and optionally `children`.
 * @param title The main title for the Table of Contents (e.g., "目录").
 * @returns A string containing the full HTML for the Table of Contents,
 * designed to be inserted into a Puppeteer-rendered page.
 * If `sidebarItems` is empty, a message indicating no TOC is available is returned.
 */
export function generateTocHtml(sidebarItems: SidebarItem[], title: string): string {
    if (!sidebarItems || sidebarItems.length === 0) {
        return `
            <div class="docusaurus-toc-body" style="font-family: var(--ifm-font-family-base, -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif); color: var(--ifm-font-color-base, #2e353b); line-height: 1.6; padding: 20px; page-break-after: always;">
                <h1 class="toc-title" style="font-size: 2em; font-weight: 700; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--ifm-toc-border-color, #eee); color: var(--ifm-font-color-base, #2e353b);">
                    ${title}
                </h1>
                <p style="font-size: 1rem; color: var(--ifm-font-color-secondary, #666);">No table of contents available.</p>
            </div>
        `;
    }
    
    /**
     * Recursively renders the HTML for nested Table of Contents items.
     * Applies indentation and appropriate CSS classes based on the item's level and type.
     *
     * @param items The array of `SidebarItem` objects for the current level.
     * @param level The current indentation level (0 for top-level items).
     * @returns An HTML string representing the list of TOC items for the given level.
     */
    const renderTocItems = (items: SidebarItem[], level: number): string => {
        if (!items || items.length === 0) {
            return '';
        }
        
        let html = `<ul>`; // Start a new unordered list
        
        items.forEach(item => {
            const hasChildren = item.children && item.children.length > 0;
            // Assign class to differentiate between directories (with children) and documents (no children)
            const itemClass = hasChildren ? 'toc-directory' : 'toc-document';
            // Calculate left padding for indentation based on the current level
            const indentationStyle = `padding-left: ${level * 0.8}rem;`;
            
            html += `<li class="${itemClass}" style="${indentationStyle}">`;
            // Create the link to the item's ID, its styling is handled by the CSS classes
            html += `<a href="#${item.id}">${item.title}</a>`;
            
            // Recursively render children if they exist
            if (hasChildren) {
                html += renderTocItems(item.children, level + 1);
            }
            html += `</li>`;
        });
        
        html += `</ul>`;
        return html;
    };
    
    // Render the top-level TOC items (starting at level 0)
    const tocHtmlContent = renderTocItems(sidebarItems, 0);
    
    // Construct the final TOC HTML, including the embedded styling
    return `
        <div class="docusaurus-toc-body" style="page-break-after: always;">
            <style>
                /* CSS variables defining Docusaurus-like theme colors and fonts */
                :root {
                    --ifm-font-family-base: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif;
                    --ifm-font-color-base: #2e353b;
                    --ifm-font-color-secondary: #666;
                    --ifm-link-color: #25c2a0; /* Docusaurus green for links */
                    --ifm-link-hover-color: #1a8f74; /* Darker green on hover (for consistency, though not active in PDF) */
                    --ifm-toc-border-color: #eee;
                    --ifm-h1-font-size: 2em;
                    --ifm-h1-font-weight: 700;
                    --ifm-spacing-vertical: 0.4rem; /* Vertical spacing between list items */
                }

                /* Overall container for the Table of Contents */
                .docusaurus-toc-body {
                    font-family: var(--ifm-font-family-base, -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif);
                    color: var(--ifm-font-color-base, #2e353b);
                    line-height: 1.5; /* Slightly tighter line height for TOC readability */
                    padding: 20px;
                    box-sizing: border-box; /* Ensures padding is included in element's total dimensions */
                    max-width: 100%; /* Prevents horizontal overflow */
                }

                /* Styling for the main TOC title (e.g., "目录") */
                .docusaurus-toc-body h1.toc-title {
                    font-size: var(--ifm-h1-font-size, 2em);
                    font-weight: var(--ifm-h1-font-weight, 700);
                    margin-bottom: 25px; /* Space below the title */
                    padding-bottom: 12px; /* Padding above the bottom border */
                    border-bottom: 1px solid var(--ifm-toc-border-color, #eee); /* Separator line */
                    color: var(--ifm-font-color-base, #2e353b);
                }

                /* Styling for unordered lists within the TOC */
                .docusaurus-toc-body ul {
                    list-style: none; /* Remove default bullet points */
                    margin: 0;
                    padding: 0;
                }

                /* Styling for individual list items */
                .docusaurus-toc-body li {
                    position: relative; /* Needed for ::before positioning */
                    margin-bottom: var(--ifm-spacing-vertical, 0.4rem); /* Controlled vertical spacing */
                    line-height: 1.4; /* Item line height */
                    font-size: 1rem; /* Base font size for all list items */
                }

                /* Common styling for all links within TOC items */
                .docusaurus-toc-body li a {
                    text-decoration: none; /* No underline */
                    display: block; /* Makes the entire area clickable/selectable */
                    padding: 0.1rem 0.2rem; /* Small padding around text for visual comfort */
                    border-radius: 4px; /* Slight rounded corners for a modern look */
                    transition: background-color 0.2s ease, color 0.2s ease; /* Smooth transitions (for web, but good practice) */
                }

                /* Specific styling for Directory items (categories with children) */
                .docusaurus-toc-body li.toc-directory > a {
                    color: var(--ifm-font-color-base, #2e353b); /* Base text color, less like a link, more like a category heading */
                    font-weight: 600; /* Bolder to signify a grouping */
                }

                /* Specific styling for Document items (actual pages, no children) */
                .docusaurus-toc-body li.toc-document > a {
                    color: var(--ifm-link-color, #25c2a0); /* Docusaurus green for document links */
                    font-weight: normal; /* Regular weight */
                }
                
                /* Icon for Directory items (a modern triangle) */
                .docusaurus-toc-body li.toc-directory::before {
                    content: '➤ '; /* Unicode triangle character */
                    color: var(--ifm-font-color-secondary, #999); /* Grayish triangle color */
                    font-size: 0.7em; /* Smaller relative to text */
                    margin-right: 0.4rem; /* Space between icon and text */
                    display: inline-block; /* Allows width and alignment properties */
                    width: 0.8rem; /* Fixed width for consistent spacing */
                    text-align: left; /* Align icon within its fixed width */
                    transform: scaleY(0.8); /* Slightly compresses the icon vertically for better visual balance */
                    opacity: 0.8; /* Slight transparency for a softer look */
                }

                /* Adjust padding for links to align text, accounting for the icon's presence */
                .docusaurus-toc-body li.toc-directory > a {
                    padding-left: 0; /* No left padding on the link itself, as the icon provides the visual offset */
                    display: inline-block; /* Necessary for the ::before icon to align correctly with text */
                }
                .docusaurus-toc-body li.toc-document > a {
                    /* For document items (no icon), apply padding to simulate the icon's space for alignment */
                    padding-left: 1.2rem; /* Matches the visual offset created by the icon for directory items */
                }

            </style>
            <h1 class="toc-title">${title}</h1>
            ${tocHtmlContent}
        </div>
    `;
}

/**
 * Generates the HTML string for a dynamic cover page, designed to fit a specified
 * paper format (e.g., A4, Letter) and display a provided Base64 encoded image
 * centered within it.
 *
 * This function embeds the necessary CSS styling directly into the HTML
 * using inline styles on the `div` and `img` elements for a self-contained
 * cover page. It's suitable for direct injection into a Puppeteer page for PDF generation.
 *
 * @param imageMimeType The MIME type of the image (e.g., 'image/jpeg', 'image/png').
 * @param imageBase64 The Base64 encoded string of the image. It can optionally
 * include the "data:mime/type;base64," prefix; the function will handle its removal
 * if present.
 * @param format An object specifying the dimensions of the paper format for the cover page.
 * It should have `widthMm` and `heightMm` properties, representing width and height in millimeters.
 * @param altText Optional. The alternative text for the image, used for accessibility.
 * Defaults to 'Cover Image'.
 * @returns A string containing the complete HTML for the cover page.
 */
export function generateCoverHtml(
    imageMimeType: string,
    imageBase64: string,
    format: { widthMm: number; heightMm: number }, // Using inline type for clarity in JSDoc
    altText: string = 'Cover Image',
): string {
    // Ensure Base64 data does not contain the prefix; if it does, remove it.
    // This makes the function robust to different input formats for imageBase64Data.
    const imageData = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    // Construct the full Data URL, which browsers can interpret directly as an image source.
    const dataUrl = `data:${imageMimeType};base64,${imageData}`;
    
    return `
    <div style="
      width: ${format.widthMm}mm;     /* Sets the width of the cover page container to the specified format's width in millimeters */
      height: ${format.heightMm}mm;    /* Sets the height of the cover page container to the specified format's height in millimeters */
      display: flex;                /* Uses Flexbox for easy centering of the image within the container */
      justify-content: center;      /* Horizontally centers the image using Flexbox */
      align-items: center;          /* Vertically centers the image using Flexbox */
      background-color: #ffffff;    /* Ensures a white background for the cover page */
      overflow: hidden;             /* Prevents content (especially the image) from overflowing its container */
      margin: 0; padding: 0;        /* Resets default outer margins and inner padding for the div */
      box-sizing: border-box;       /* Sets the box model to border-box, so padding and border are included in the width/height */
      page-break-after: always;     /* Forces a page break after this div in the generated PDF, ensuring the cover is on its own page */
    ">
      <img
        src="${dataUrl}"            /* Sets the image source to the Base64 Data URL */
        alt="${altText}"            /* Provides alternative text for accessibility */
        style="
          max-width: 100%;          /* Ensures the image does not exceed the width of its container */
          max-height: 100%;         /* Ensures the image does not exceed the height of its container */
          object-fit: contain;      /* Scales the image to fit within its container while maintaining its aspect ratio */
          display: block;           /* Changes image from inline to block-level to remove extra space below it */
        "
      />
    </div>`;
}