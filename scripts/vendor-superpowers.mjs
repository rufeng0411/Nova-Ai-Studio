#!/usr/bin/env node
// PD-SAAS-FORK: batch_dev_quality — obra/superpowers cherry-pick
import { runVendorBatch } from './lib/vendorBatchManifest.mjs';
runVendorBatch('batch_dev_quality_superpowers', '[vendor-superpowers]');
