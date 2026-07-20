import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const header = readFileSync('src/userscript-header.txt', 'utf8');

await esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/mplis.user.js',
    banner: { js: header },
    legalComments: 'none',
    charset: 'utf8',
});

console.log('Built dist/mplis.user.js');
