import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all script files to create entry points
const scriptFiles = glob.sync('./src/scripts/*.ts', { cwd: __dirname });

const entries = {};
scriptFiles.forEach(file => {
  const name = path.basename(file, '.ts');
  // Use absolute path for entry point
  entries[name] = path.resolve(__dirname, file);
});

export default {
  mode: 'production',
  entry: entries,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.webpack.json'),
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: [
    // k6 modules are external - they're provided by the k6 runtime
    /^k6(\/.*)?$/,
    // Remote HTTP imports are external
    /^https?:\/\/.*/,
  ],
  optimization: {
    minimize: false, // Keep readable for debugging
  },
  target: 'web', // k6 uses a web-like environment
  stats: {
    colors: true,
    warnings: true,
    errors: true,
  },
};
