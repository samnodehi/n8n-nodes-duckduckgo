const path = require('path');
const { task, src, dest } = require('gulp');

task('build:icons', copyIcons);

function copyIcons() {
	// Only copy the DuckDuckGo icon since that's all we need
	const nodeSource = path.resolve('nodes', 'DuckDuckGo', '*.svg');
	const nodeDestination = path.resolve('dist', 'nodes', 'DuckDuckGo');

	return src(nodeSource).pipe(dest(nodeDestination));
}
