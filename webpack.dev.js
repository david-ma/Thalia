const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

// Get project name from environment or default to 'example'
const projectName = process.env.PROJECT || 'example';

// Helper function to get file path with fallback to example
function getProjectFilePath(filePath) {
  const projectFile = path.join(__dirname, 'websites', projectName, filePath);
  const exampleFile = path.join(__dirname, 'websites', 'example', filePath);
  
  return fs.existsSync(projectFile) ? projectFile : exampleFile;
}

// Get entry point with fallback
const entryPoint = getProjectFilePath('src/index.ts');

module.exports = {
  mode: 'development',
  entry: entryPoint,
  output: {
    path: path.resolve(__dirname, `websites/${projectName}/public`),
    filename: '[name].js',
    publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, `websites/${projectName}/src`),
      'example': path.resolve(__dirname, 'websites/example/src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, 'tsconfig.json')
            }
          }
        ],
        include: [
          // Include project-specific TypeScript files
          path.resolve(__dirname, `websites/${projectName}/src`),
          path.resolve(__dirname, `websites/${projectName}/config`),
          // Include example TypeScript files as fallback
          path.resolve(__dirname, 'websites/example/src'),
          path.resolve(__dirname, 'websites/example/config')
        ],
        exclude: /node_modules/
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
          'sass-loader'
        ],
        include: [
          // Include project-specific SCSS files
          path.resolve(__dirname, `websites/${projectName}/src`),
          // Include example SCSS files as fallback
          path.resolve(__dirname, 'websites/example/src')
        ]
      }
    ]
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300
  }
}; 