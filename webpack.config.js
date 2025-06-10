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
  
  // Always prefer project file if it exists
  return fs.existsSync(projectFile) ? projectFile : exampleFile;
}

// Register Handlebars partials
function registerPartials() {
  // Register the example partials first (they'll be overwritten by project partials if they exist)
  const examplePartialsDir = path.join(__dirname, 'websites', 'example', 'src/partials');
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

  // Register the project partials, overwriting any example partials
  const partialsDir = getProjectFilePath('src/partials');
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

// Create plugins array
const plugins = [
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
  new ForkTsCheckerWebpackPlugin()
];

// Only add CopyPlugin if the source directory exists
const srcDir = getProjectFilePath('src');
if (fs.existsSync(srcDir)) {
  plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: srcDir,
          to: path.resolve(__dirname, `websites/${projectName}/public`),
          globOptions: {
            ignore: ['**/*.ts', '**/*.scss', '**/*.hbs']
          }
        }
      ]
    })
  );
}

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
      '@': path.resolve(__dirname, `websites/${projectName}/src`),
      // Add aliases to ensure project files take precedence
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
        use: [
          {
            loader: 'handlebars-loader',
            options: {
              partialDirs: [
                // Project partials first (they'll take precedence)
                getProjectFilePath('src/partials'),
                // Example partials as fallback
                path.join(__dirname, 'websites', 'example', 'src/partials')
              ],
              helperDirs: [
                // Project helpers first (they'll take precedence)
                getProjectFilePath('src/helpers'),
                // Example helpers as fallback
                path.join(__dirname, 'websites', 'example', 'src/helpers')
              ]
            }
          }
        ]
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
  plugins,
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