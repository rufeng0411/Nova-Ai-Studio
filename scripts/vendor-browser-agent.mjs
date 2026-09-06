#!/usr/bin/env node
import { runVendorBatch } from './lib/vendorBatchManifest.mjs';
runVendorBatch('batch_browser', '[vendor-browser-agent]');
