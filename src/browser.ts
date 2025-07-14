import puppeteer, {Browser, Page} from 'puppeteer';

/**
 * Requests an image from a given URL using Puppeteer and returns its Base64 encoded data and MIME type.
 * This function navigates a Puppeteer page directly to the image URL, fetches its content,
 * and then encodes it into a Base64 string. This is particularly useful for embedding images
 * directly into HTML (e.g., for cover pages) without needing to save them as separate files.
 *
 * @param page The Puppeteer `Page` instance to use for making the request.
 * @param url The absolute URL of the image to request.
 * @returns {Promise<{ imageBase64: string, imageMimeType: string }>} A Promise that resolves to an object
 * containing:
 * - `imageBase64`: The Base64 encoded string of the image data. Returns an empty string if the buffer is null or undefined.
 * - `imageMimeType`: The MIME type of the image (e.g., 'image/jpeg', 'image/png'). Returns an empty string if content-type header is not found.
 */
export async function requestForImage(page: Page, url: string): Promise<{ imageBase64: string; imageMimeType: string }> {
    const imgSrcResponse = await page.goto(url);
    const imgSrcBuffer = await imgSrcResponse?.buffer();
    const imageBase64 = imgSrcBuffer?.toString('base64') || '';
    const imageMimeType = imgSrcResponse?.headers()['content-type'] || '';
    return { imageBase64, imageMimeType };
}

/**
 * Launches a new Puppeteer browser instance with a predefined set of configurations
 * optimized for headless operation and common use cases like PDF generation.
 *
 * @returns {Promise<Browser>} A Promise that resolves to a Puppeteer `Browser` instance.
 */
export async function launchBrowser(): Promise<Browser> {
    return await puppeteer.launch({
        /**
         * Runs Puppeteer in headless mode.
         *
         * `true`: Runs the browser in the background without a visible UI. This is
         * ideal for server environments and automated tasks for performance.
         * `false`: Runs the browser with a visible UI, useful for debugging and observation.
         */
        headless: true,
        /**
         * An array of custom arguments to pass to the Chromium browser instance.
         * These arguments control various browser behaviors and settings.
         */
        args: [
            /**
             * `--window-size=2560,1440`: Sets the initial window size of the browser.
             * This is particularly useful in headless mode to ensure consistent rendering
             * dimensions, which can impact how elements are laid out before PDF generation.
             * (e.g., 2560x1440 is a common large desktop resolution).
             */
            '--window-size=2560,1440',
            /**
             * `--no-sandbox`: Disables the Chromium sandbox.
             * This is often required when running Puppeteer in restricted environments
             * (e.g., Docker containers, CI/CD pipelines) where the sandbox might not
             * have the necessary privileges, preventing the browser from launching.
             * Use with caution in untrusted environments as it reduces security.
             */
            '--no-sandbox',
            /**
             * `--disable-setuid-sandbox`: Disables the setuid sandbox.
             * Similar to `--no-sandbox`, this is necessary in some Linux environments
             * to allow Chromium to run without elevated privileges.
             */
            '--disable-setuid-sandbox',
            /**
             * `--disable-web-security`: Disables the same-origin policy.
             * This allows a page to make cross-origin requests without CORS restrictions.
             * Useful if your Docusaurus site loads assets (e.g., fonts, images, scripts)
             * from different domains or subdomains, which might be blocked by default.
             * Use with extreme caution as it bypasses a fundamental web security feature.
             */
            '--disable-web-security',
            /**
             * `--disable-features=IsolateOrigins,site-per-process`: Disables site isolation.
             * This can reduce memory consumption and potentially improve performance by
             * preventing each cross-site frame from running in a separate process.
             * It's often used in conjunction with `--disable-web-security` when dealing
             * with complex cross-domain content.
             */
            '--disable-features=IsolateOrigins,site-per-process',
            // Consider adding these for better stability/performance in server/CI environments:
            // '--disable-dev-shm-usage', // Overcomes limited /dev/shm space in some environments (e.g., Docker)
            // '--disable-accelerated-2d-canvas', // Disables hardware acceleration for 2D canvas
            // '--disable-gpu', // Disables GPU hardware acceleration, useful in headless/server contexts
            // '--single-process', // Runs browser in a single process, can reduce overhead but might be less stable
        ],
        // You can also add a `timeout` for the browser launch itself if it's sometimes slow
        // timeout: 60000, // e.g., 60 seconds
    });
}