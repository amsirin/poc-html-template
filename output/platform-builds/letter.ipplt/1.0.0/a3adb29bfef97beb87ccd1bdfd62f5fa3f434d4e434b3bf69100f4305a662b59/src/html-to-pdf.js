// HTML -> PDF without a baseline; document JavaScript is deliberately disabled.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import http from 'http';
import https from 'https';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || process.argv.length !== 4) {
  console.error('Usage: node src/html-to-pdf.js <self-contained.html> <output.pdf>');
  process.exit(1);
}
try {
  const url = new URL(`${(process.env.PDFREACTOR_URL || 'http://localhost:9423').replace(/\/$/, '')}/service/rest/convert.pdf`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PDFREACTOR_URL must use HTTP or HTTPS');
  const body = JSON.stringify({ document: readFileSync(resolve(inputPath), 'utf8'),
    javaScriptSettings: { disabled: true } });
  const pdf = await new Promise((resolvePdf, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/pdf',
        'Content-Length': Buffer.byteLength(body) },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('PDFreactor response was interrupted')));
      response.on('end', () => {
        const bytes = Buffer.concat(chunks);
        if (response.statusCode !== 200 || bytes.subarray(0, 5).toString() !== '%PDF-') {
          reject(new Error(`PDFreactor returned HTTP ${response.statusCode} or a non-PDF response`));
        } else resolvePdf(bytes);
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('PDFreactor exceeded 60 seconds')), 60000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
    request.end(body);
  });
  const target = resolve(outputPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, pdf);
  console.log(`PDF: ${target} (${pdf.length} bytes; document JavaScript disabled)`);
} catch (error) {
  console.error(error.message || error.code || error.name);
  process.exitCode = 1;
}
