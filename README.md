# PDF Personalizer

A browser app for adding text to an existing PDF, either individually or in a CSV batch. Files are processed locally in your browser and are not uploaded to a server.

## Development

Requires Node.js 22.12+ (validated with Node.js 24).

```sh
npm ci
npm run dev
```

`npm run build` builds the app. `npm test` validates PDF output, page placement, and CSV value substitution.

## Use

1. Upload an existing PDF.
2. Click on a page to add a text field. Drag it into position, name it, and choose text, font size, and color. Use the page buttons for multipage PDFs.
3. Download a single personalized PDF, or select CSV batch.
4. Download the CSV template, fill in one row per recipient, and upload it. Column headers must match the unique field names. Download the resulting ZIP.

Text is added over the original document; existing text is not erased or edited. This initial version uses Helvetica with Latin characters and requires unrotated, unencrypted PDFs. Field layouts last for the current browser session; uploading another PDF resets the fields. Large batches use browser memory.
