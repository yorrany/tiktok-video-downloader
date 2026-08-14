const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const src = path.join(__dirname, '..', 'src');

module.exports = {
	entry: {
		popup: path.join(src, 'popup', 'index.tsx'),
		background: path.join(src, 'background', 'index.ts'),
		content: path.join(src, 'content', 'index.ts'),
	},
	output: {
		path: path.join(__dirname, '..', 'dist'),
		filename: '[name].js',
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
		alias: {
			'react': 'preact/compat',
			'react-dom/test-utils': 'preact/test-utils',
			'react-dom': 'preact/compat',
			'react/jsx-runtime': 'preact/jsx-runtime',
		},
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [{
				from: '.',
				context: path.join(__dirname, '..', 'public'),
			}],
		}),
	],
};
