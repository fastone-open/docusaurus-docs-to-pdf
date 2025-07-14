/**
 * Represents a single item within the Docusaurus sidebar structure.
 * This can be either a documentation page or a category (directory)
 * that contains other pages or sub-categories.
 */
export interface SidebarItem {
    /**
     * The display title of the sidebar item, as shown in the navigation.
     * For example: "Introduction", "Getting Started", "API Reference".
     */
    title: string;
    /**
     * A unique identifier for the sidebar item.
     * This ID is often used as an anchor in the generated PDF for internal links.
     * It typically corresponds to the Docusaurus document ID or a generated unique ID.
     */
    id: string;
    /**
     * The internal path of the document or category.
     * This might be a relative path within the Docusaurus documentation structure,
     * e.g., 'docs/introduction', 'docs/api/overview'.
     */
    path: string;
    /**
     * The absolute URL to the Docusaurus page associated with this sidebar item.
     * This URL is used by Puppeteer to navigate to and extract content from the page.
     * For categories without a dedicated page, it might be a placeholder like '#'.
     */
    url: string;
    /**
     * An optional array of child `SidebarItem` objects.
     * If present, this indicates that the current item is a category (directory)
     * containing nested documents or sub-categories.
     */
    children: SidebarItem[];
}

/**
 * Represents the detailed content extracted from a single Docusaurus page.
 * This interface extends `SidebarItem` by adding the actual HTML content
 * of the page after it has been processed and cleaned.
 */
export interface PageDetails {
    /**
     * The unique identifier for the page, matching the `id` from `SidebarItem`.
     */
    id: string;
    /**
     * The display title of the page, matching the `title` from `SidebarItem`.
     */
    title: string;
    /**
     * The absolute URL of the page, matching the `url` from `SidebarItem`.
     */
    url: string;
    /**
     * The internal path of the page, matching the `path` from `SidebarItem`.
     */
    path: string;
    /**
     * The extracted and processed HTML content of the documentation page.
     * This HTML snippet is typically what will be merged into the final PDF document.
     */
    html: string;
}

/**
 * Defines the dimensions for a standard paper format.
 */
export type PaperFormat = {
    /** The width of the paper in millimeters. */
    widthMm: number;
    /** The height of the paper in millimeters. */
    heightMm: number;
};

/**
 * A map containing predefined dimensions for common paper formats.
 * Use these keys (e.g., 'A4', 'Letter') when generating covers.
 */
export const PAPER_FORMATS: { [key: string]: PaperFormat } = {
    A4: { widthMm: 210, heightMm: 297 },
    Letter: { widthMm: 216, heightMm: 279 }, // US Letter size in mm (approx)
    // Add more formats here as needed
    // Tabloid: { widthMm: 279, heightMm: 432 },
};