'use strict';

var core = require('./core.js');
var require$$2 = require('node:fs');
require('os');
require('crypto');
require('fs');
require('path');
require('http');
require('https');
require('net');
require('tls');
require('events');
require('assert');
require('util');
require('stream');
require('buffer');
require('querystring');
require('stream/web');
require('node:stream');
require('node:util');
require('node:events');
require('worker_threads');
require('perf_hooks');
require('util/types');
require('async_hooks');
require('console');
require('url');
require('zlib');
require('string_decoder');
require('diagnostics_channel');
require('child_process');
require('timers');

var post$1 = {};

var hasRequiredPost;

function requirePost () {
	if (hasRequiredPost) return post$1;
	hasRequiredPost = 1;
	const core$1 = core.requireCore();
	const fs = require$$2;

	function cleanupTool(toolPath) {
	  if (!toolPath) {
	    core$1.info('No tool path state found. Skipping cleanup.');
	    return
	  }

	  if (!fs.existsSync(toolPath)) {
	    core$1.info(`Tool path does not exist: ${toolPath}`);
	    return
	  }

	  fs.rmSync(toolPath, {recursive: true, force: true});
	  core$1.info(`Removed tool path: ${toolPath}`);
	}

	function run() {
	  try {
	    const toolPath = core$1.getState('tool-path');
	    cleanupTool(toolPath);
	  } catch (error) {
	    core$1.warning(
	      `Cleanup warning: ${error instanceof Error ? error.message : String(error)}`
	    );
	  }
	}

	run();
	return post$1;
}

var postExports = requirePost();
var post = /*@__PURE__*/core.getDefaultExportFromCjs(postExports);

module.exports = post;
