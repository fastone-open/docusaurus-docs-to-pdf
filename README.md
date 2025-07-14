# Docusaurus To PDF Converter

## Introduction

This is a Node.js and Puppeteer-based command-line tool designed to capture and merge Docusaurus website documentation content into a single PDF file. It aims to automate documentation archiving, offline reading, or generating printable versions.

## Features

* **Full Site PDF Export**: Exports all documentation pages from a Docusaurus site into a single, cohesive PDF file.
* **Concurrent Processing**: Leverages Puppeteer's concurrency capabilities to speed up the page content fetching process.
* **Custom Cover Page**: Supports adding a custom PDF cover page using either a URL or a local file path.
* **Automatic Table of Contents (TOC) Generation**: Automatically generates a clickable PDF table of contents based on the Docusaurus sidebar structure.
* **Navigable Internal Links**: Rewrites all internal links within the documentation so they remain clickable and navigable in a PDF reader.
* **Configurable Margins**: Supports adjusting PDF page margins via command-line arguments.

## Installation

```bash
npm install -g docusaurus-docs-to-pdf
# or
yarn global add docusaurus-docs-to-pdf
```

## Usage

Run the script from the command line and pass the appropriate arguments.

### Command-Line Arguments

```bash
docusaurus-docs-to-pdf -h
# or
npx docusaurus-docs-to-pdf -h
```

### Examples

**Generate pdf from Docusaurus website**

```bash
docusaurus-docs-to-pdf --docs-url https://docusaurus.io/docs --pdf-path docusaurus.pdf --pdf-cover-image https://docusaurus.io/img/docusaurus_keytar.svg
# or
npx docusaurus-docs-to-pdf --docs-url https://docusaurus.io/docs --pdf-path docusaurus.pdf --pdf-cover-image https://docusaurus.io/img/docusaurus_keytar.svg
```