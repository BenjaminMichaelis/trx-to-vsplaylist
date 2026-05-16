'use strict';

var core = require('./core.js');
var require$$2 = require('node:fs');
var require$$3 = require('node:os');
var require$$4 = require('node:path');
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

var main$1 = {};

var hasRequiredMain;

function requireMain () {
	if (hasRequiredMain) return main$1;
	hasRequiredMain = 1;
	const core$1 = core.requireCore();
	const exec = core.requireExec();
	const fs = require$$2;
	const os = require$$3;
	const path = require$$4;

	async function installTool(toolPath, toolVersion) {
	  const installArgs = [
	    'tool',
	    'install',
	    '--tool-path',
	    toolPath,
	    'trx-to-vsplaylist',
	    '--version',
	    toolVersion,
	    '--source',
	    'https://api.nuget.org/v3/index.json'
	  ];

	  try {
	    await exec.exec('dotnet', installArgs);
	  } catch {
	    const updateArgs = [
	      'tool',
	      'update',
	      '--tool-path',
	      toolPath,
	      'trx-to-vsplaylist',
	      '--version',
	      toolVersion,
	      '--source',
	      'https://api.nuget.org/v3/index.json'
	    ];
	    await exec.exec('dotnet', updateArgs);
	  }
	}

	async function run() {
	  try {
	    const toolVersion = core$1.getInput('tool-version', {required: true});
	    const runnerTemp = process.env.RUNNER_TEMP || os.tmpdir();
	    const toolPath = path.join(runnerTemp, '.dotnet-tools-trx-to-vsplaylist');

	    fs.mkdirSync(toolPath, {recursive: true});
	    core$1.saveState('tool-path', toolPath);
	    core$1.saveState('tool-version', toolVersion);

	    core$1.info(`Installing trx-to-vsplaylist ${toolVersion}...`);
	    await installTool(toolPath, toolVersion);
	    core$1.addPath(toolPath);
	    core$1.info(`trx-to-vsplaylist ${toolVersion} is ready`);
	  } catch (error) {
	    core$1.setFailed(error instanceof Error ? error.message : String(error));
	  }
	}

	run();
	return main$1;
}

var mainExports = requireMain();
var main = /*@__PURE__*/core.getDefaultExportFromCjs(mainExports);

module.exports = main;
