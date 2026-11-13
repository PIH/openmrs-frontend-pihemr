#!/usr/bin/env node
/*
 * Supports country-specific frontend builds.
 *
 * Each country can have its own build config, spa-build-config.<country>.json, listing the frontend modules
 * that country's distribution needs. <country> is the value the distribution sets as frontendCountry in its
 * pom (sierraLeone, haiti, liberia, lesotho, malawi). spa-build-config.json is the default, used by every
 * distribution that has no config of its own. Only "frontendModules" is read from the country-specific files;
 * everything else (configUrls, etc.) comes from spa-build-config.json.
 *
 * Commands:
 *
 *   aggregate [outFile=target/spa-build-config.all.json]
 *     Merges the frontendModules of every spa-build-config*.json into one config, which is what
 *     `openmrs assemble` is fed, so each module is downloaded once. Fails if two configs ask for
 *     different versions of the same module.
 *
 *   split [distDir=target/dist]
 *     Run after assemble/build. Rewrites importmap.json and routes.registry.json to contain only the
 *     modules of spa-build-config.json, and writes importmap.<country>.json and routes.registry.<country>.json
 *     (plus .gz/.br siblings) for each country-specific config. See README.md for how a distribution
 *     puts its country's files in place.
 *
 * Both take the directory holding the configs as an optional last argument (default: the cwd).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

const DEFAULT_CONFIG = 'spa-build-config.json';
const COUNTRY_CONFIG = /^spa-build-config\.([A-Za-z0-9_-]+)\.json$/;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Returns [{ country: undefined | string, file, frontendModules }], the default config first. */
function loadConfigs(configDir) {
  const names = readdirSync(configDir)
    .filter((f) => f === DEFAULT_CONFIG || COUNTRY_CONFIG.test(f))
    .sort((a, b) => (a === DEFAULT_CONFIG ? -1 : b === DEFAULT_CONFIG ? 1 : a.localeCompare(b)));
  if (names[0] !== DEFAULT_CONFIG) {
    throw new Error(`${join(configDir, DEFAULT_CONFIG)} not found.`);
  }
  return names.map((file) => {
    const { frontendModules } = readJson(join(configDir, file));
    if (!frontendModules || typeof frontendModules !== 'object') {
      throw new Error(`${file} has no "frontendModules".`);
    }
    return { country: file === DEFAULT_CONFIG ? undefined : file.match(COUNTRY_CONFIG)[1], file, frontendModules };
  });
}

function aggregate(outFile, configDir) {
  const configs = loadConfigs(configDir);
  const all = {};
  const declaredBy = {};
  for (const { file, frontendModules } of configs) {
    for (const [name, version] of Object.entries(frontendModules)) {
      if (name in all && all[name] !== version) {
        throw new Error(
          `${name} is "${all[name]}" in ${declaredBy[name]} but "${version}" in ${file}; ` +
            `all spa-build-config*.json files must agree on versions.`,
        );
      }
      all[name] = version;
      declaredBy[name] = declaredBy[name] ?? file;
    }
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ frontendModules: all }, null, 2) + '\n');
  console.log(
    `Aggregated ${Object.keys(all).length} frontend modules from ${configs.map((c) => c.file).join(', ')} into ${outFile}`,
  );
}

/** Writes `content` to `file` and refreshes its .gz/.br siblings, if `file` had any: the SPA module serves precompressed siblings in preference. */
function writeWithSiblings(file, content, siblingsFrom) {
  writeFileSync(file, content, 'utf8');
  const encodings = [
    { suffix: '.gz', compress: (b) => gzipSync(b, { level: zlibConstants.Z_BEST_COMPRESSION }) },
    {
      suffix: '.br',
      compress: (b) =>
        brotliCompressSync(b, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: zlibConstants.BROTLI_MAX_QUALITY } }),
    },
  ];
  for (const { suffix, compress } of encodings) {
    if (existsSync(siblingsFrom + suffix)) {
      writeFileSync(file + suffix, compress(Buffer.from(content, 'utf8')));
    }
  }
}

function split(distDir, configDir) {
  const configs = loadConfigs(configDir);
  const files = {
    importmap: { path: join(distDir, 'importmap.json'), key: 'imports' },
    'routes.registry': { path: join(distDir, 'routes.registry.json'), key: 'routes' },
  };
  const full = {};
  for (const [base, { path }] of Object.entries(files)) {
    if (!existsSync(path)) {
      throw new Error(`${path} not found. Has "openmrs assemble" been run?`);
    }
    full[base] = readJson(path);
  }

  // Compute everything before writing anything, so a problem leaves dist untouched.
  const outputs = [];
  for (const { country, file, frontendModules } of configs) {
    const missing = Object.keys(frontendModules).filter((name) => !(name in full.importmap.imports));
    if (missing.length > 0) {
      throw new Error(
        `${file}: ${missing.join(', ')} not in ${files.importmap.path}. ` +
          `It must be assembled from the aggregated config, and split can only be run once per assemble.`,
      );
    }
    for (const [base, { path, key }] of Object.entries(files)) {
      const json = { ...full[base], [key]: {} };
      for (const name of Object.keys(frontendModules)) {
        // a module can legitimately have no routes file, but can't have gone missing from the importmap
        if (name in full[base][key]) {
          json[key][name] = full[base][key][name];
        }
      }
      const target = country === undefined ? path : join(distDir, `${base}.${country}.json`);
      outputs.push({ target, content: JSON.stringify(json), siblingsFrom: path });
    }
    console.log(`${country ?? '(default)'}: ${Object.keys(frontendModules).length} frontend modules (${file})`);
  }
  for (const { target, content, siblingsFrom } of outputs) {
    writeWithSiblings(target, content, siblingsFrom);
  }
}

const [command, ...args] = process.argv.slice(2);
const configDir = resolve(args[1] ?? '.');
if (command === 'aggregate') {
  aggregate(resolve(args[0] ?? 'target/spa-build-config.all.json'), configDir);
} else if (command === 'split') {
  split(resolve(args[0] ?? 'target/dist'), configDir);
} else {
  console.error('Usage: country-build-configs.mjs aggregate [outFile] [configDir] | split [distDir] [configDir]');
  process.exit(1);
}
