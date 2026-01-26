import {SidebarItem} from "./type";

/**
 * Generates an HTML string for a Table of Contents (TOC) based on a
 * hierarchical sidebar structure. The generated TOC aims to mimic professional
 * PDF document styling, including clear hierarchy, indentation, and dot leaders.
 *
 * @param sidebarItems An array of `SidebarItem` objects, potentially nested,
 * representing the structure of the documentation. Each item
 * should at least have `id`, `title`, and optionally `children`.
 * @param title The main title for the Table of Contents (e.g., "目录").
 * @returns A string containing the full HTML for the Table of Contents,
 * designed to be inserted into a Puppeteer-rendered page.
 */
export function generateTocHtml(sidebarItems: SidebarItem[], title: string): string {
    if (!sidebarItems || sidebarItems.length === 0) {
        return `<div class="docusaurus-toc-body" style="padding: 40px; text-align: center; background: white; font-family: sans-serif;"><h1 class="toc-title">${title}</h1><p>No table of contents available.</p></div>`;
    }

    /**
     * Recursively renders the HTML for nested Table of Contents items.
     */
    const renderTocItems = (items: SidebarItem[], level: number): string => {
        if (!items || items.length === 0) return '';
        let html = `<ul>`;
        items.forEach(item => {
            const hasChildren = item.children && item.children.length > 0;
            const itemClass = hasChildren ? 'toc-directory' : 'toc-document';
            const levelClass = `toc-level-${level}`;
            // VMware style: items have small consistent indentation
            const indentation = level === 0 ? 0 : 15;
            html += `<li class="${itemClass} ${levelClass}" style="margin-left: ${indentation}pt;"><a href="#${item.id}"><span>${item.title}</span></a>`;
            if (hasChildren) {
                html += renderTocItems(item.children, level + 1);
            }
            html += `</li>`;
        });
        html += `</ul>`;
        return html;
    };

    const tocHtmlContent = renderTocItems(sidebarItems, 0);

    return `<div class="docusaurus-toc-body" style="background: white;">
            <style>
                .docusaurus-toc-body {
                    font-family: "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                    color: #1a1a1a;
                    line-height: 1.5;
                    padding: 0.5cm 0;
                    margin: 0;
                    box-sizing: border-box;
                    counter-reset: chapter;
                }

                .docusaurus-toc-body h1.toc-title {
                    font-size: 28pt;
                    font-weight: 800;
                    margin-bottom: 20pt;
                    border-bottom: 2.5pt solid #000;
                    padding-bottom: 10pt;
                    color: #000;
                    text-align: left;
                }

                .docusaurus-toc-body ul {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }

                .docusaurus-toc-body li {
                    page-break-inside: auto;
                }

                .docusaurus-toc-body a {
                    text-decoration: none;
                    color: inherit;
                    display: flex;
                    align-items: baseline;
                    padding: 4pt 0;
                }

                /* Level 0 (Main Chapters) */
                .toc-level-0 {
                    margin-top: 15pt;
                }
                .toc-level-0 > a {
                    font-size: 14pt;
                    color: #000;
                }
                /* Only bold if it's a directory (has children) */
                .toc-level-0.toc-directory > a {
                    font-weight: bold;
                }
                /* If it's a top-level document with no children, use normal weight */
                .toc-level-0.toc-document > a {
                    font-weight: normal;
                }

                /* Level 1 (Sections) */
                .toc-level-1 > a {
                    font-size: 12pt;
                    color: #000;
                }
                .toc-level-1.toc-directory > a {
                    font-weight: bold;
                }
                .toc-level-1.toc-document > a {
                    font-weight: normal;
                }

                /* Level 2+ (Subsections) */
                .toc-level-2 > a, .toc-level-3 > a, .toc-level-4 > a, .toc-level-5 > a {
                    font-size: 11pt;
                    font-weight: normal;
                    color: #333;
                }

                .docusaurus-toc-body a::after {
                    content: "";
                    flex-grow: 1;
                    border-bottom: 1.2pt dotted #bbb;
                    margin-left: 8pt;
                    order: 2;
                }

                .docusaurus-toc-body a span {
                    order: 1;
                    max-width: 88%;
                    line-height: 1.3;
                }
            </style>
            <h1 class="toc-title">${title}</h1>
            ${tocHtmlContent}
        </div>`;
}

/**
 * Generates the HTML string for a dynamic cover page.
 */
export function generateCoverHtml(
    imageMimeType: string,
    imageBase64: string,
    format: { widthMm: number; heightMm: number },
    altText: string = 'Cover Image',
): string {
    const imageData = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const dataUrl = `data:${imageMimeType};base64,${imageData}`;

    return `<div class="pdf-cover" style="width: 100%; height: 100%; max-height: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center; background-color: #ffffff; margin: 0; padding: 0; box-sizing: border-box;">
      <img src="${dataUrl}" alt="${altText}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" />
    </div>`;
}
