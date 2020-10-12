// moduleShim.ts
/**
 * This shim is required at the start of the thalia.js bundle
 * so that the AMD modules work properly.
 * And index.js must come after the modules have been defined.
 * Use 'files' in tsconfig to ensure correct order.
 * DKGM 12-Oct-2020
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
