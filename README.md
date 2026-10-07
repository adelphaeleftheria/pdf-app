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
2. Click on a page to add text. Select a text chip or click existing text to edit it in the single editor. Drag it into position; choose Helvetica, Times Roman, or Courier, size, color, bold, italic, and underline. Duplicate or delete fields with one click. Use the page buttons for multipage PDFs.
3. Download a single personalized PDF, or select CSV batch.
4. In CSV batch mode, give each field a unique CSV column name. Download the CSV template, fill in one row per recipient, and upload it. Column headers must match those names. Download the resulting ZIP.

Text is added over the original document; existing text is not erased or edited. This initial version uses Helvetica with Latin characters and requires unrotated, unencrypted PDFs. Uploading another PDF resets the fields. Use Save layout to download a reusable JSON file, then upload the original PDF and use Load layout to restore it. Large batches use browser memory.

Use the header theme button to switch between light and dark mode. Your theme is remembered on this device. Text supports multiple lines.

On Windows, run `npm.cmd ci` and `npm.cmd run dev` in PowerShell. To update an existing clone, stop the app, run `git pull origin main`, then those commands.

## Reuse your setup

Click **Save layout** after placing your fields. Keep the downloaded `pdf-layout.json` and your original PDF. Next time, upload that PDF and click **Load layout** to choose the JSON. It restores all field positions, pages, text, CSV column names, fonts, colors, and styles. Layouts require matching page counts and sizes; use the original PDF to preserve alignment. Loading replaces current fields after confirmation. Layout files include the text you entered, so store them accordingly.

In CSV batch mode, empty cells generate no text and no underline; they never use the example text from the editor. Explicitly quoted empty single-column rows and rows of empty cells are retained. The original PDF underneath is preserved.

For custom batch filenames, enter a **Filename prefix** and choose a CSV column under **Append CSV value**. For example, `Certificate_` plus the `Name` column creates `Certificate_Alice.pdf`. A preview shows the first filename. Duplicate names get numbered suffixes, and invalid filename characters are replaced. Filename settings are also saved with your layout.
