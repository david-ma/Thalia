const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const fs = require('fs');
const Handlebars = require('handlebars');
const CopyPlugin = require('copy-webpack-plugin');

// Get project name from environment or default to 'example'
const projectName = process.env.PROJECT || 'example';

// Helper function to get file path with fallback to example
function getProjectFilePath(filePath) {
  const projectFile = path.join(__dirname, 'websites', projectName, filePath);
  const exampleFile = path.join(__dirname, 'websites', 'example', filePath);

  return fs.existsSync(projectFile) ? projectFile : exampleFile;
}

// Register Handlebars partials 
function registerPartials() {
  // Register the example partials first
  const examplePartialsDir = getProjectFilePath('src/partials');
  if (fs.existsSync(examplePartialsDir)) {
    const examplePartialFiles = fs.readdirSync(examplePartialsDir);
    examplePartialFiles.forEach(file => {
      if (file.endsWith('.hbs')) {
        const partialName = path.basename(file, '.hbs');
        const partialContent = fs.readFileSync(path.join(examplePartialsDir, file), 'utf8');
        Handlebars.registerPartial(partialName, partialContent);
      }
    });
  }

  const partialsDir = getProjectFilePath('src/partials');
  // Register the project partials, overwriting the example partials if they exist
  if (fs.existsSync(partialsDir)) {
    const partialFiles = fs.readdirSync(partialsDir);
    partialFiles.forEach(file => {
      if (file.endsWith('.hbs')) {
        const partialName = path.basename(file, '.hbs');
        const partialContent = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        Handlebars.registerPartial(partialName, partialContent);
      }
    });
  }
}

// Get entry point with fallback
const entryPoint = getProjectFilePath('src/index.ts');
const templateFile = getProjectFilePath('src/index.hbs');

// Register partials before creating the plugin
registerPartials();

// Check for file conflicts in src directory
function checkFileConflicts() {
  const srcDir = getProjectFilePath('src');
  if (!fs.existsSync(srcDir)) return;

  const files = fs.readdirSync(srcDir, { recursive: true });
  const fileMap = new Map(); // Map of base names to their extensions

  files.forEach(file => {
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    const fullPath = path.join(srcDir, file);

    // Skip directories
    if (fs.statSync(fullPath).isDirectory()) return;

    // Check for conflicts between different file types
    if (fileMap.has(baseName)) {
      const existingExt = fileMap.get(baseName);
      const conflictingTypes = {
        '.html': '.hbs',
        '.hbs': '.html',
        '.js': '.ts',
        '.ts': '.js',
        '.css': '.scss',
        '.scss': '.css'
      };

      if (conflictingTypes[ext] === existingExt) {
        throw new Error(
          `File conflict detected in src directory: ${baseName}${ext} and ${baseName}${existingExt}`
        );
      }
    }

    fileMap.set(baseName, ext);
  });
}

// Check for conflicts before building
checkFileConflicts();

module.exports = {
  entry: entryPoint,
  output: {
    path: path.resolve(__dirname, `websites/${projectName}/public`),
    filename: '[name].[contenthash].js',
    publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, `websites/${projectName}/src`)
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
              transpileOnly: true
            }
          }
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
        ]
      },
      {
        test: /\.hbs$/,
        use: 'handlebars-loader'
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: templateFile,
      filename: 'index.html',
      templateParameters: {
        title: 'Example Project',
        subtitle: 'A modern web development framework',
        siteName: 'Thalia Framework',
        currentYear: new Date().getFullYear(),
        features: [
          {
            title: 'TypeScript',
            description: 'Modern type-safe JavaScript development'
          },
          {
            title: 'SCSS',
            description: 'Powerful CSS preprocessing'
          },
          {
            title: 'Handlebars',
            description: 'Flexible templating system'
          }
        ]
      }
    }),
    new CopyPlugin({
      patterns: [
        {
          from: getProjectFilePath('src'),
          to: path.resolve(__dirname, `websites/${projectName}/public`),
          globOptions: {
            ignore: ['**/*.ts', '**/*.scss', '**/*.hbs']
          }
        }
      ]
    }),
    new ForkTsCheckerWebpackPlugin()
  ],
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  }
}; 