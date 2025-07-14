#!/usr/bin/env node

import {Browser, Page} from 'puppeteer'; // 导入 Browser 类型
import {
    expandDetails,
    expandDocusaurusSidebar,
    extractDocusaurusSidebarItems,
    getElementOuterHtml,
    removeElements, removeLazyLoading,
    replaceBodyInnerHtml,
    rewriteLinks,
    updateElementId
} from './docusaurus';
import {PageDetails, PAPER_FORMATS, PaperFormat, SidebarItem} from "./type";
import {generateCoverHtml, generateTocHtml} from "./html";
import {launchBrowser, requestForImage} from "./browser";
import consoleStamp from "console-stamp";
import path from "node:path";
import * as fs from "node:fs";

import { Command } from 'commander';
import * as os from "node:os";

/**
 * Builds details for multiple Docusaurus documentation pages concurrently.
 * This function orchestrates a concurrency pool to efficiently visit, process,
 * and extract HTML content from each page, ensuring the final results are
 * ordered according to the original sidebar structure.
 *
 * It includes nested helper functions for flattening the sidebar and processing
 * individual pages, keeping all related logic self-contained.
 *
 * @param browser The Puppeteer `Browser` instance from which new pages (tabs) will be created.
 * @param sidebarItems A nested array of `SidebarItem` objects representing the
 * hierarchical structure of the Docusaurus documentation.
 * @param maxConcurrency The maximum number of browser pages (workers) to open and
 * process simultaneously. A higher number might speed up processing but could
 * increase resource consumption. (e.g., 5-10 for stability; up to CPU core count for max throughput).
 * @returns {Promise<PageDetails[]>} A Promise that resolves to an array of `PageDetails` objects.
 * Each object contains the extracted HTML content and metadata
 * for a documentation page, ordered as per the `sidebarItems` input.
 */
export async function buildPageDetailsParallel(
    browser: Browser,
    sidebarItems: SidebarItem[],
    maxConcurrency: number
): Promise<PageDetails[]> {
    
    /**
     * Helper function: Recursively flattens a nested array of `SidebarItem` objects into a single-level array.
     * It identifies actual documentation pages (items with valid URLs that are not just placeholders)
     * and adds them to the flattened list, regardless of whether they have children categories or not.
     *
     * @param {SidebarItem[]} items The current level of `SidebarItem` objects to traverse.
     * @param {SidebarItem[]} flattenedList The accumulator array where flattened page items are pushed.
     * @returns {SidebarItem[]} The flattened array of `SidebarItem` objects, containing only actual page entries.
     */
    function extractPages(items: SidebarItem[], flattenedList: SidebarItem[]): SidebarItem[] {
        for (const item of items) {
            if (item.children.length == 0 && item.url && item.url !== '#' && !item.url.endsWith('/#')) {
                flattenedList.push({ ...item });
            }
            
            if (item.children && item.children.length > 0) {
                extractPages(item.children, flattenedList);
            }
        }
        return flattenedList;
    }
    
    /**
     * Helper function: Processes a single Docusaurus page to extract its main content HTML.
     * This function creates a new Puppeteer page (tab) for each task. It navigates to the page,
     * waits for essential elements, expands collapsible sections, updates the main content element's ID,
     * and then extracts its outer HTML.
     *
     * @param browser The Puppeteer `Browser` instance used to create new pages.
     * @param sidebarItem The `SidebarItem` object containing the page's metadata (title, ID, URL).
     * @param workerContext An object providing context about the worker processing this page,
     * including its unique `workerId` for logging.
     * @returns {Promise<PageDetails>} A Promise that resolves to a `PageDetails` object,
     * including the extracted HTML content. Returns a `PageDetails`
     * object with empty HTML and logs an error if processing fails.
     */
    async function processSinglePage(browser: Browser, sidebarItem: SidebarItem, workerContext: { workerId: number }): Promise<PageDetails> {
        const page: Page = await browser.newPage(); // Create a new browser page (tab) for this task
        const { workerId } = workerContext; // Destructure workerId for consistent logging
        try {
            // Log for starting process for THIS specific page
            console.log(`[Worker ${workerId}] Processing page "${sidebarItem.title}" (URL: ${sidebarItem.url})...`);
            
            // Navigate to the page. Wait until network is idle (no more than 0 connections for 500ms).
            // Set a timeout to prevent indefinite waiting if the page fails to load.
            await page.goto(sidebarItem.url, { waitUntil: 'networkidle0', timeout: 60000 });
            
            // Wait for the main Docusaurus content container to be present in the DOM.
            // This ensures the primary content area is rendered before proceeding.
            // Note: The selector targets a specific Docusaurus theme layout component.
            await page.waitForSelector('div[class^="docItemContainer"]>article>div[class*="theme-doc-markdown"]', { timeout: 60000 });
            console.log(`[Worker ${workerId}] Page "${sidebarItem.title}" loaded and main content selector found.`);
            
            // Execute a script within the page context to expand any collapsible <details> elements.
            // This ensures all hidden content is visible for extraction.
            await page.evaluate(expandDetails);
            console.log(`[Worker ${workerId}] Expanded collapsible details for "${sidebarItem.title}".`);
            
            // Update the main Docusaurus content element's ID to a unique, generated ID.
            // This is crucial for creating correct internal anchor links in the merged PDF.
            // The selector must match the one used for `waitForSelector` above.
            await page.evaluate(updateElementId, 'div[class^="docItemContainer"]>article>div[class*="theme-doc-markdown"]', sidebarItem.id);
            console.log(`[Worker ${workerId}] Element ID updated to "${sidebarItem.id}" for "${sidebarItem.title}".`);
            
            // Get the outer HTML of the content container using its new unique ID.
            const html = await page.evaluate(getElementOuterHtml, '#' + sidebarItem.id);
            
            // Log for successful completion of THIS specific page
            console.log(`[Worker ${workerId}] Successfully processed page "${sidebarItem.title}".`);
            
            return {
                ...sidebarItem, // Include original sidebar item metadata
                html: html // Add the extracted HTML content
            };
        } catch (error) {
            // Log clear error for THIS specific page, including URL and worker ID
            console.error(`[Worker ${workerId}] ERROR processing page "${sidebarItem.title}" (URL: ${sidebarItem.url}): ${error instanceof Error ? error.message : String(error)}`);
            return {
                ...sidebarItem, // Return original metadata even on failure
                html: ``, // Provide empty HTML to avoid breaking the overall process
            };
        } finally {
            // Crucial: Always close the page after its task is done to release browser resources.
            await page.close();
            // No need for a "page closed" log for every single page, it adds too much noise
        }
    }
    
    // --- Main `buildPageDetailsParallel` Logic ---
    
    // Flatten the hierarchical sidebar items into a single list of pages to process.
    const pagesToProcess = extractPages(sidebarItems, []);
    console.log(`[Page Fetcher] Extracted ${pagesToProcess.length} documentation pages to process.`);
    
    const totalPages = pagesToProcess.length;
    console.log(`[Page Fetcher] Starting to fetch content for ${totalPages} pages using ${maxConcurrency} concurrent workers.`);
    
    // Pre-allocate an array to store results in the correct order.
    // This ensures the final output array maintains the original sequence of pages from `pagesToProcess`.
    const orderedPageDetails: PageDetails[] = new Array(totalPages);
    let currentIndex = 0; // Tracks the next page index to be assigned to a worker
    
    // Create `maxConcurrency` number of "worker promises".
    // Each worker promise will continuously pick up tasks until all pages are processed.
    const workerPromises = Array.from({ length: maxConcurrency }, async (_, workerId) => {
        // The worker starts implicitly when its promise is created. No explicit "worker started" log here to reduce noise.
        while (true) {
            let pageIndexToProcess: number; // Stores the original index of the page to be processed
            let pageSummaryToProcess: SidebarItem | undefined;
            
            // Atomically get the next page index to process.
            // `currentIndex++` is safe in this concurrent context for primitive types.
            if (currentIndex < totalPages) {
                pageIndexToProcess = currentIndex;
                pageSummaryToProcess = pagesToProcess[pageIndexToProcess];
                currentIndex++; // Increment for the next worker to pick up
            } else {
                // All pages have been assigned. This worker has completed all its tasks and can stop.
                console.log(`[Worker ${workerId}] All assigned tasks completed. Worker thread finishing.`);
                break; // Exit the worker's processing loop
            }
            
            // The detailed "Processing page..." log is inside `processSinglePage` to avoid redundant logging here.
            
            // Process the page using the nested helper function, passing worker context.
            const pageDetail = await processSinglePage(browser, pageSummaryToProcess, { workerId });
            // Store the result directly into its correct position in the pre-allocated ordered array.
            orderedPageDetails[pageIndexToProcess] = pageDetail;
            
            // The "Successfully processed page..." log is inside `processSinglePage`.
        }
    });
    
    // Wait for all worker promises to complete.
    // `Promise.all` will only resolve when every single worker has exhausted its tasks
    // and all pages have been processed (or attempted to be processed).
    await Promise.all(workerPromises);
    
    console.log(`[Page Fetcher] Finished fetching content for all ${totalPages} pages.`);
    console.log(`[Page Fetcher] Final results collected for ${orderedPageDetails.length} pages.`);
    return orderedPageDetails; // Return the correctly ordered array of page details
}

/**
 * Resolves a given path string into an absolute URL that a browser can understand.
 * This handles:
 * - Direct HTTP/HTTPS URLs (e.g., 'https://example.com/image.jpg')
 * - 'file:///'-prefixed URLs (returns as is)
 * - 'classpath:'-prefixed paths (resolved against CWD/project root)
 * - 'file:'-prefixed paths (resolved as local file system paths)
 * - Relative or absolute file system paths (resolved to absolute 'file:///' URLs).
 *
 * @param inputPath The input path string provided by the user.
 * @returns {string} An absolute URL (HTTP(S) or file:///) that Puppeteer can use.
 * @throws {Error} If a 'classpath:' or 'file:' resource is not found or is invalid.
 */
function resolveBrowserUrl(inputPath: string): string {
    if (!inputPath) {
        return '';
    }
    
    // 1. Handle HTTP/HTTPS URLs directly
    if (inputPath.startsWith('http://') || inputPath.startsWith('https://')) {
        return inputPath;
    }
    
    // 2. Handle 'file:///' URLs (already absolute for browser)
    if (inputPath.startsWith('file:///')) {
        // Ensure the file actually exists for 'file:///' URLs to prevent silent failures later
        const localPath = decodeURIComponent(inputPath.substring(7)); // Remove 'file:///' and decode
        if (!fs.existsSync(localPath)) {
            throw new Error(`File not found: ${localPath} (from URL: ${inputPath})`);
        }
        return inputPath;
    }
    
    let absoluteFilePath: string;
    
    // 3. Handle 'classpath:' and 'file:' prefixes (Node.js context)
    if (inputPath.startsWith('classpath:')) {
        // For 'classpath:', we typically resolve relative to the current working directory
        // or a predefined 'resource' directory in a Node.js project.
        // For simplicity here, we'll resolve relative to the process's current working directory.
        const relativePath = inputPath.substring('classpath:'.length);
        absoluteFilePath = path.resolve(process.cwd(), relativePath);
        console.log(`[Path Resolver] Resolved classpath: "${inputPath}" to local path: "${absoluteFilePath}"`);
    } else if (inputPath.startsWith('file:')) {
        // For 'file:', resolve as an absolute file path.
        // Handle potential Windows drive letters if inputPath is 'file:///C:/...'
        absoluteFilePath = path.resolve(inputPath.substring('file:'.length));
        console.log(`[Path Resolver] Resolved file: "${inputPath}" to local path: "${absoluteFilePath}"`);
    } else {
        // 4. Handle plain relative or absolute file paths
        // Treat as a local file system path and resolve to absolute
        absoluteFilePath = path.resolve(inputPath);
        console.log(`[Path Resolver] Resolved relative/absolute path: "${inputPath}" to local path: "${absoluteFilePath}"`);
    }
    
    // Ensure the resolved file actually exists
    if (!fs.existsSync(absoluteFilePath)) {
        throw new Error(`Local file not found at resolved path: ${absoluteFilePath} (from input: ${inputPath})`);
    }
    
    // Convert the absolute file path to a 'file:///' URL for the browser
    // Handle Windows paths where 'C:\' becomes 'file:///C:/'
    const fileUrl = 'file:///' + absoluteFilePath.replace(/\\/g, '/'); // Replace backslashes for URL consistency
    return fileUrl;
}
/**
 * Defines all configurable options for the PDF generation process.
 * These options are typically passed via command-line arguments and control
 * the source of documentation, output path, cover image, page margins,
 * and the level of concurrent processing.
 */
export interface PdfGenerationOptions {
    /**
     * The base URL of the Docusaurus documentation to convert.
     * Example: 'http://localhost:3000/docs/introduction'.
     */
    docsUrl: string;
    /**
     * The full file path where the generated PDF document will be saved.
     * Example: 'output/my-docs.pdf'.
     */
    pdfPath: string;
    /**
     * Optional. The URL or local file path to an image to be used as the PDF cover page.
     * This can be an absolute URL (http/https), a relative or absolute file system path,
     * or a path prefixed with 'file:///' or 'classpath:'.
     * If provided, a dedicated cover page will be generated.
     */
    pdfCoverImage?: string; // Explicitly marked as optional
    /**
     * The size of the margins for all sides of the PDF pages, in millimeters (mm).
     * For example, 20 indicates a 20mm margin on top, bottom, left, and right.
     */
    pdfMarginMm: number;
    /**
     * The maximum number of browser pages (tabs) to use concurrently for fetching
     * and processing individual documentation pages.
     * Higher values can speed up content extraction but may increase memory and CPU consumption.
     * A common balance for I/O-bound tasks is to set this to 1.5 to 2 times the number of CPU cores.
     */
    pageConcurrency: number;
}

async function convertDocusaurusPageToPdf(
    {docsUrl, pdfPath, pdfCoverImage, pdfMarginMm, pageConcurrency}:
    PdfGenerationOptions
): Promise<void> {
    // Define the PDF paper format (e.g., 'A4'). This dictates the physical page dimensions.
    const pdfFormat = 'A4';
    // Retrieve the dimensions (width and height in mm) for the specified paper format.
    const paperFormat: PaperFormat = PAPER_FORMATS[pdfFormat];
    
    /**
     * Helper function: Builds the hierarchical sidebar items structure from an initial Docusaurus URL.
     * This involves navigating to the URL, waiting for the main content to load,
     * expanding the sidebar's collapsible sections, and then extracting the structured sidebar data.
     * This function runs within the main Puppeteer page.
     *
     * @param page The Puppeteer `Page` instance to navigate and extract from.
     * @param url The initial URL of the Docusaurus documentation to start sidebar parsing from.
     * @returns {Promise<SidebarItem[]>} A Promise that resolves to a nested array of `SidebarItem` objects.
     */
    async function buildSidebarItems(page: Page, url: string): Promise<SidebarItem[]> {
        console.log(`[Stage 1/4 - Setup] Navigating to initial Docusaurus URL for sidebar extraction: ${url}`);
        await page.goto(url, {waitUntil: 'networkidle0', timeout: 60000});
        await page.waitForSelector('#__docusaurus', {timeout: 60000});
        await page.evaluate(expandDocusaurusSidebar);
        return await page.evaluate(extractDocusaurusSidebarItems);
    }
    
    let browser: Browser | undefined;
    try {
        // --- Stage 1: Browser and Page Setup ---
        console.log("[Stage 1/4 - Setup] Launching browser...");
        browser = await launchBrowser();
        console.log("[Stage 1/4 - Setup] Browser launched successfully.");
        console.log("[Stage 1/4 - Setup] Creating new Puppeteer page...");
        const page = await browser.newPage();
        console.log("[Stage 1/4 - Setup] Page created.");
        
        let coverImageBase64: string | undefined;
        let coverImageMimeType: string | undefined;
        
        // If a PDF cover image path/URL is provided, resolve it to a browser-compatible URL
        // and then request and base64 encode it.
        if (pdfCoverImage) {
            console.log(`[Stage 1/4 - Setup] Resolving cover image path: "${pdfCoverImage}"`);
            let resolvedCoverImageUrl: string;
            try {
                resolvedCoverImageUrl = resolveBrowserUrl(pdfCoverImage);
                console.log(`[Stage 1/4 - Setup] Resolved to browser URL: "${resolvedCoverImageUrl}"`);
            } catch (pathError) {
                console.error(`[Stage 1/4 - Setup] ERROR: Could not resolve cover image path "${pdfCoverImage}". Skipping cover page. Details: ${pathError instanceof Error ? pathError.message : String(pathError)}`);
                pdfCoverImage = undefined; // Nullify pdfCoverImage to skip cover generation
            }
            
            if (pdfCoverImage) { // Check again in case it was nullified
                console.log("[Stage 1/4 - Setup] Requesting cover image data...");
                const {imageBase64, imageMimeType} = await requestForImage(page, resolvedCoverImageUrl!); // Use ! as we handled nullification
                console.log("[Stage 1/4 - Setup] Cover image data successfully retrieved.");
                coverImageBase64 = imageBase64;
                coverImageMimeType = imageMimeType;
            }
        }
        
        // --- Stage 2: Data Collection (Sidebar & Page Content) ---
        console.log("[Stage 2/4 - Data Collection] Building sidebar structure...");
        const sidebarItems: SidebarItem[] = await buildSidebarItems(page, docsUrl);
        console.log(`[Stage 2/4 - Data Collection] Sidebar structure built with ${sidebarItems.length} top-level items.`);
        
        const buildDetailsStartTime = Date.now();
        console.log(`[Stage 2/4 - Data Collection] Starting concurrent content extraction for all documentation pages.`);
        
        const pageDetails = await buildPageDetailsParallel(browser, sidebarItems, pageConcurrency);
        const buildDetailsEndTime = Date.now();
        const buildDetailsDuration = (buildDetailsEndTime - buildDetailsStartTime) / 1000;
        console.log(`[Stage 2/4 - Data Collection] Content extraction completed. Took ${buildDetailsDuration.toFixed(2)} seconds.`);
        
        // --- Stage 3: HTML Merging and Rendering on Page ---
        console.log("[Stage 3/4 - HTML Rendering] Merging all extracted HTML content...");
        let html = '';
        if (pdfCoverImage && coverImageBase64 && coverImageMimeType) {
            const coverHtml = generateCoverHtml(
                coverImageMimeType,
                coverImageBase64,
                paperFormat // Pass the resolved paper format object
            );
            html += coverHtml;
        } else if (pdfCoverImage) {
            console.warn("[Stage 3/4 - HTML Rendering] PDF Cover Image URL was provided but image data could not be retrieved. Skipping cover page.");
        }
        
        const tocHtml = generateTocHtml(sidebarItems, '目录');
        html += tocHtml;
        
        for (const singlePageDetail of pageDetails) { // Renamed 'page' to 'singlePageDetail' for clarity
            html += singlePageDetail.html;
        }
        console.log("[Stage 3/4 - HTML Rendering] All content merged. Injecting into Puppeteer page...");
        
        await page.evaluate(replaceBodyInnerHtml, html);
        await page.evaluate(removeLazyLoading);
        console.log("[Stage 3/4 - HTML Rendering] HTML content injected into Puppeteer page's DOM.");
        
        if (pdfCoverImage) {
            await page.addStyleTag({
                content: `
                    @page:first {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                `
            });
            console.log("[Stage 3/4 - HTML Rendering] Applied special margin style for cover page.");
        }
        
        await page.addStyleTag({
            content: `
                @page {
                    margin: ${pdfMarginMm}mm !important;
                }
            `
        });
        console.log(`[Stage 3/4 - HTML Rendering] Applied general page margins of ${pdfMarginMm}mm.`);
        
        const pathToAnchors = pageDetails.map(it => [it.path, it.id] as [string, string]);
        await page.evaluate(rewriteLinks, pathToAnchors);
        console.log("[Stage 3/4 - HTML Rendering] Internal links rewritten to point to anchor IDs.");
        
        await page.evaluate(
            removeElements,
            [
                'nav.theme-doc-breadcrumbs',
                'footer.theme-doc-footer',
                'nav.pagination-nav',
            ]
        );
        console.log("[Stage 3/4 - HTML Rendering] Unwanted elements removed from DOM.");
        
        console.log('[Stage 3/4 - HTML Rendering] Waiting for injected HTML to render and network to be idle...');
        await page.waitForNetworkIdle();
        console.log('[Stage 3/4 - HTML Rendering] HTML rendering and network idle complete.');
        
        // --- Stage 4: PDF Generation ---
        console.log(`[Stage 4/4 - PDF Generation] Starting PDF generation to: ${pdfPath}...`);
        const pdfStartTime = Date.now();
        await page.pdf({
            path: pdfPath,
            format: pdfFormat,
            printBackground: true,
            margin: {
                top: pdfMarginMm + 'mm',
                bottom: pdfMarginMm + 'mm',
                left: pdfMarginMm + 'mm',
                right: pdfMarginMm + 'mm',
            },
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="
                    font-size: 10px;
                    width: 100%;
                    text-align: center;
                    margin: 0;
                    padding: 0;
                ">
                </div>
            `,
            footerTemplate: `
                <div style="
                    font-size: 10px;
                    width: 100%;
                    text-align: center;
                    margin: 0;
                    padding: 0;
                ">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `,
            timeout: 0,
        });
        const pdfEndTime = Date.now();
        const pdfDuration = (pdfEndTime - pdfStartTime) / 1000;
        console.log(`[Stage 4/4 - PDF Generation] PDF generated successfully. Took ${pdfDuration.toFixed(2)} seconds.`);
        
    } catch (error) {
        console.error(`[PDF Conversion ERROR] An error occurred during the PDF conversion process: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error) {
            console.error(error.stack);
        }
    } finally {
        if (browser) {
            console.log("[Cleanup] Closing browser...");
            await browser.close();
            console.log("[Cleanup] Browser closed.");
        }
    }
}


// --- Execution Start ---
/**
 * Main execution block of the script.
 * Parses command-line arguments and initiates the PDF conversion process.
 */
async function main() {
    consoleStamp(console)
    try {
        const program = new Command(); // Create a new Command instance
        console.log("[App Start] Starting PDF generation process...");

        program
            .version('0.0.2')
            .description('Converts Docusaurus documentation to a single PDF file.')
            .option('-u, --docs-url <url>', 'The base URL of the Docusaurus documentation (e.g., "http://localhost:3000/docs/introduction")')
            .option('-o, --pdf-path <path>', 'The output file path for the generated PDF (e.g., "output/my-docs.pdf")')
            .option('-c, --pdf-cover-image <pathOrUrl>', 'Optional. The URL or local file path (e.g., "cover.jpg", "/path/to/cover.jpg" "file:///path/to/image.jpg") for the PDF cover image.')
            .option('-m, --pdf-margin-mm <number>', 'The margin size in millimeters to apply to all sides of the PDF pages.', '10')
            .option('-p, --page-concurrency <number>', 'The maximum number of concurrent browser pages to use for content fetching (e.g., 5, 10). Defaults to 2x CPU cores.', `${os.cpus().length * 2}`)
            .parse(process.argv); // Parse the arguments
        
        const options = program.opts(); // Get the parsed options
        if (!options.docsUrl) {
            program.error('Missing required option: --docs-url <url>');
        }
        if (!options.pdfPath) {
            program.error('Missing required option: --pdf-path <path>');
        }

        const pdfGenerationOptions: PdfGenerationOptions = {
            docsUrl: options.docsUrl as string,
            pdfPath: options.pdfPath as string,
            pdfCoverImage: options.pdfCoverImage as string | undefined,
            pdfMarginMm: parseInt(options.pdfMarginMm, 10),
            pageConcurrency: parseInt(options.pageConcurrency, 10),
        };
        if (isNaN(pdfGenerationOptions.pdfMarginMm)) {
            console.warn(`[Arg Parser] Warning: --pdf-margin-mm could not be parsed as a number. Using default of 10mm.`);
            pdfGenerationOptions.pdfMarginMm = 10;
        }

        if (!pdfGenerationOptions.pdfPath.endsWith('.pdf')) {
            console.warn(`[Arg Parser] Warning: --pdf-path "${pdfGenerationOptions.pdfPath}" does not end with .pdf. Appending .pdf extension.`);
            pdfGenerationOptions.pdfPath += '.pdf';
        }
        if (!path.isAbsolute(pdfGenerationOptions.pdfPath)) {
            pdfGenerationOptions.pdfPath = path.resolve(process.cwd(), pdfGenerationOptions.pdfPath);
            console.log(`[Arg Parser] Resolved --pdf-path to absolute: "${pdfGenerationOptions.pdfPath}"`);
        }
        const outputDir = path.dirname(pdfGenerationOptions.pdfPath);
        if (!fs.existsSync(outputDir)) {
            console.log(`[Arg Parser] Creating output directory: ${outputDir}`);
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        console.log("[App Start] Parsed options:", pdfGenerationOptions);
        
        await convertDocusaurusPageToPdf(pdfGenerationOptions);
        console.log("[App End] PDF generation process finished successfully.");
        
    } catch (error) {
        console.error(`[App ERROR] Critical error: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error) {
            console.error(error.stack);
        }
        process.exit(1); // Exit with a non-zero code to indicate an error
    }
}

// Invoke the main function to start the application
main();