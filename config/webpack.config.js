'use strict';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const resolve = require('resolve');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
// const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
// const ESLintPlugin = require('eslint-webpack-plugin');
const PreloadWebpackPlugin = require('preload-webpack-plugin');
const appEntry = require('./getEntry');
const getOutPut = require('./getOutPut');
const getHtmlWebpackPlugin = require('./getHtmlWebpackPlugin');
const paths = require('./paths');
const modules = require('./modules');
const getClientEnvironment = require('./env');
// const ForkTsCheckerWebpackPlugin =
//     process.env.TSC_COMPILE_ON_ERROR === 'true'
//         ? require('react-dev-utils/ForkTsCheckerWarningWebpackPlugin')
//         : require('react-dev-utils/ForkTsCheckerWebpackPlugin');
// const appPackage = require(paths.appPackageJson);

const createEnvironmentHash = require('./webpack/persistentCache/createEnvironmentHash');
// gzip 压缩
// const CompressionPlugin = require('compression-webpack-plugin');
// Source maps are resource heavy and can cause out of memory issue for large source files.
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false';

// const reactRefreshWebpackPluginRuntimeEntry = require.resolve('@pmmmwh/react-refresh-webpack-plugin');
// const babelRuntimeEntry = require.resolve('babel-preset-react-app');
// const babelRuntimeEntryHelpers = require.resolve('@babel/runtime/helpers/esm/assertThisInitialized', { paths: [babelRuntimeEntry] });
// const babelRuntimeRegenerator = require.resolve('@babel/runtime/regenerator', {
//     paths: [babelRuntimeEntry]
// });
const chalk = require('react-dev-utils/chalk');

// Some apps do not need the benefits of saving a web request, so not inlining the chunk
// makes for a smoother build process.
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

const emitErrorsAsWarnings = process.env.ESLINT_NO_DEV_ERRORS === 'true';
const disableESLintPlugin = false;

const imageInlineSizeLimit = parseInt(process.env.IMAGE_INLINE_SIZE_LIMIT || '10000');

// Check if TypeScript is setup
const useTypeScript = fs.existsSync(paths.appTsConfig);

// Check if Tailwind config exists
// const useTailwind = fs.existsSync(path.join(paths.appPath, 'tailwind.config.js'));

// Get the path to the uncompiled service worker (if it exists).
const swSrc = paths.swSrc;

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const lessRegex = /\.less$/;
const lessModuleRegex = /\.module\.less$/;

const hasJsxRuntime = (() => {
    if (process.env.DISABLE_NEW_JSX_TRANSFORM === 'true') {
        return false;
    }

    try {
        require.resolve('react/jsx-runtime');
        return true;
    } catch (e) {
        return false;
    }
})();

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = function (webpackEnv) {
    const isEnvDevelopment = webpackEnv === 'development';
    const isEnvProduction = webpackEnv === 'production';

    // Variable used for enabling profiling in Production
    // passed into alias object. Uses a flag if passed into the build command
    const isEnvProductionProfile = isEnvProduction && process.argv.includes('--profile');

    // We will provide `paths.publicUrlOrPath` to our app
    // as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
    // Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
    // Get environment variables to inject into our app.
    const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));

    const shouldUseReactRefresh = env.raw.FAST_REFRESH;

    // common function to get style loaders
    const getStyleLoaders = (cssOptions, preProcessor) => {
        const loaders = [
            isEnvDevelopment && require.resolve('style-loader'),
            isEnvProduction && {
                loader: MiniCssExtractPlugin.loader,
                // css is located in `static/css`, use '../../' to locate index.html folder
                // in production `paths.publicUrlOrPath` can be a relative path
                options: paths.publicUrlOrPath.startsWith('.') ? { publicPath: '../../../' } : {}
            },
            {
                loader: require.resolve('css-loader'),
                options: {
                    ...cssOptions,
                    url: {
                        filter: (url) => {
                            if (/^data:/.test(url)) {
                                return false;
                            }
                            return true;
                        }
                    }
                }
            },
            {
                // Options for PostCSS as we reference these options twice
                // Adds vendor prefixing based on your specified browser support in
                // package.json
                loader: require.resolve('postcss-loader'),
                options: {
                    postcssOptions: {
                        // Necessary for external CSS imports to work
                        // https://github.com/facebook/create-react-app/issues/2677
                        ident: 'postcss',
                        // config: {
                        //     path: 'postcss.config.js'
                        // },
                        plugins: [
                            'postcss-flexbugs-fixes',
                            [
                                'postcss-preset-env',
                                {
                                    autoprefixer: {
                                        flexbox: 'no-2009'
                                    },
                                    stage: 3
                                }
                            ]
                        ]
                    },
                    sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment
                }
            }
        ].filter(Boolean);
        if (preProcessor === 'less-loader') {
            loaders.push({
                loader: require.resolve(preProcessor),
                options: {
                    sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
                    lessOptions: {
                        javascriptEnabled: true // 允许链式调用的换行
                    }
                }
            });
        }
        return loaders;
    };
    return {
        target: ['browserslist'],
        // Webpack noise constrained to errors and warnings
        stats: 'errors-warnings',
        mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
        // Stop compilation early in production
        bail: isEnvProduction,
        devtool: isEnvProduction ? (shouldUseSourceMap ? 'source-map' : false) : isEnvDevelopment && 'cheap-module-source-map',
        // These are the "entry points" to our application.
        // This means they will be the "root" imports that are included in JS bundle.
        entry: appEntry,
        output: getOutPut(webpackEnv),
        snapshot: {
            managedPaths: [path.resolve(__dirname, '../node_modules')],
            immutablePaths: [],
            buildDependencies: {
                hash: true,
                timestamp: true
            },
            module: {
                timestamp: true
            },
            resolve: {
                timestamp: true
            },
            resolveBuildDependencies: {
                hash: true,
                timestamp: true
            }
        },
        cache: isEnvDevelopment
            ? {
                  type: 'memory'
              }
            : {
                  type: 'filesystem',
                  version: createEnvironmentHash(env.raw),
                  cacheDirectory: paths.appWebpackCache,
                  store: 'pack',
                  buildDependencies: {
                      defaultWebpack: ['webpack/lib/'],
                      config: [__filename],
                      tsconfig: [paths.appTsConfig, paths.appJsConfig].filter((f) => fs.existsSync(f))
                  }
              },
        infrastructureLogging: {
            level: 'verbose'
        },
        optimization: isEnvProduction
            ? {
                  minimize: true,
                  minimizer: [
                      // This is only used in production mode
                      new TerserPlugin({
                          // 多进程打包
                          parallel: true,
                          terserOptions: {
                              parse: {
                                  // We want terser to parse ecma 8 code. However, we don't want it
                                  // to apply any minification steps that turns valid ecma 5 code
                                  // into invalid ecma 5 code. This is why the 'compress' and 'output'
                                  // sections only apply transformations that are ecma 5 safe
                                  // https://github.com/facebook/create-react-app/pull/4234
                                  ecma: 8
                              },
                              compress: {
                                  ecma: 5,
                                  warnings: false,
                                  // Disabled because of an issue with Uglify breaking seemingly valid code:
                                  // https://github.com/facebook/create-react-app/issues/2376
                                  // Pending further investigation:
                                  // https://github.com/mishoo/UglifyJS2/issues/2011
                                  comparisons: false,
                                  // Disabled because of an issue with Terser breaking valid code:
                                  // https://github.com/facebook/create-react-app/issues/5250
                                  // Pending further investigation:
                                  // https://github.com/terser-js/terser/issues/120
                                  inline: 2
                              },
                              mangle: {
                                  safari10: true
                              },
                              // 默认值是false，是否保持依赖的类名称
                              keep_classnames: isEnvProductionProfile,
                              // 默认值是false，是否保持原来的函数名称；
                              keep_fnames: isEnvProductionProfile,
                              output: {
                                  ecma: 5,
                                  comments: false,
                                  // Turned on because emoji and regex is not minified properly using default
                                  // https://github.com/facebook/create-react-app/issues/2488
                                  ascii_only: true
                              }
                          }
                      }),
                      // This is only used in production mode
                      new CssMinimizerPlugin({
                          parallel: true,
                          minimizerOptions: {
                              preset: [
                                  'default',
                                  {
                                      // 移除所有注释
                                      discardComments: { removeAll: true }
                                  }
                              ]
                          }
                      })
                  ],
                  splitChunks: {
                      chunks: 'all',
                      maxInitialRequests: Infinity,
                      minSize: 0,
                      cacheGroups: {
                          vendor: {
                              test: /[\\/]node_modules[\\/]/,
                              name(module, chunks) {
                                  const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
                                  if (packageName && packageName[1]) {
                                      return `npm.${packageName[1].replace('@', '')}`;
                                  }
                                  return false;
                              }
                          }
                      }
                  },
                  moduleIds: 'deterministic',
                  runtimeChunk: {
                      name: (entrypoint) => `runtime-${entrypoint.name}`
                  } // 选项将 runtime 代码拆分为一个单独的 chunk
              }
            : {
                  moduleIds: 'named',
                  removeAvailableModules: false,
                  removeEmptyChunks: false,
                  splitChunks: {
                      name: false
                  }
              },
        resolve: {
            fallback: { buffer: false },
            // This allows you to set a fallback for where webpack should look for modules.
            // We placed these paths second because we want `node_modules` to "win"
            // if there are any conflicts. This matches Node resolution mechanism.
            // https://github.com/facebook/create-react-app/issues/253
            modules: ['node_modules', paths.appNodeModules].concat(modules.additionalModulePaths || []),
            // These are the reasonable defaults supported by the Node ecosystem.
            // We also include JSX as a common component filename extension to support
            // some tools, although we do not recommend using it, see:
            // https://github.com/facebook/create-react-app/issues/290
            // `web` extension prefixes have been added for better support
            // for React Native Web.
            extensions: paths.moduleFileExtensions.map((ext) => `.${ext}`).filter((ext) => useTypeScript || !ext.includes('ts')),
            alias: {
                '@': path.resolve('src'),
                react: path.resolve('./node_modules/react'),
                'react-dom': path.resolve('./node_modules/react-dom'),
                'react-router-dom': path.resolve('./node_modules/react-router-dom'),
                mobx: path.resolve('./node_modules/mobx'),
                antd: path.resolve('./node_modules/antd'),
                'antd-mobile': path.resolve('./node_modules/antd-mobile'),
                '@ant-design/icons': path.resolve('./node_modules/@ant-design/icons'),
                moment: path.resolve('./node_modules/moment'),
                lodash: path.resolve('./node_modules/lodash'),
                'ace-builds': path.resolve('./node_modules/ace-builds'),
                // Allows for better profiling with ReactDevTools
                ...(isEnvProductionProfile && {
                    'react-dom$': 'react-dom/profiling',
                    'scheduler/tracing': 'scheduler/tracing-profiling'
                }),
                ...(modules.webpackAliases || {})
            },
            plugins: [
                // Prevents users from importing files from outside of src/ (or node_modules/).
                // This often causes confusion because we only process files within src/ with babel.
                // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
                // please link the files into your node_modules/ and let module-resolution kick in.
                // Make sure your source files are compiled, as they will not be processed in any way.
                // new ModuleScopePlugin(paths.appSrc, [
                //     paths.appPackageJson,
                //     reactRefreshRuntimeEntry,
                //     reactRefreshWebpackPluginRuntimeEntry,
                //     babelRuntimeEntry,
                //     babelRuntimeEntryHelpers,
                //     babelRuntimeRegenerator
                // ])
            ],
            // 减少nodemodule入口文件的寻找
            mainFields: ['browser', 'module', 'main']
        },
        module: {
            /**
             * 不需要解析依赖的第三方大型类库等，可以通过这个字段进行配置，以提高构建速度
             * 使用 noParse 进行忽略的模块文件中不会解析 import、require 等语法
             */
            noParse: /jquery/,
            strictExportPresence: true,
            rules: [
                {
                    test: /\.m?js/,
                    resolve: {
                        fullySpecified: false
                    }
                },
                // Handle node_modules packages that contain sourcemaps
                shouldUseSourceMap && {
                    enforce: 'pre',
                    exclude: /@babel(?:\/|\\{1,2})runtime/,
                    test: /\.(js|mjs|jsx)$/,
                    loader: require.resolve('source-map-loader')
                },
                {
                    // "oneOf" will traverse all following loaders until one will
                    // match the requirements. When no loader matches it will fall
                    // back to the "file" loader at the end of the loader list.
                    oneOf: [
                        // TODO: Merge this config once `image/avif` is in the mime-db
                        // https://github.com/jshttp/mime-db
                        // {
                        //     test: [/\.avif$/],
                        //     type: 'asset',
                        //     mimetype: 'image/avif',
                        //     parser: {
                        //         dataUrlCondition: {
                        //             maxSize: imageInlineSizeLimit
                        //         }
                        //     },
                        //     generator: {
                        //         // 输出文件位置以及文件名
                        //         filename: `${paths.outPath}media/[name].[hash:8].[ext]`
                        //     }
                        // },
                        // "url" loader works like "file" loader except that it embeds assets
                        // smaller than specified limit in bytes as data URLs to avoid requests.
                        // A missing `test` is equivalent to a match.
                        {
                            test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/],
                            type: 'asset',
                            parser: {
                                dataUrlCondition: {
                                    maxSize: imageInlineSizeLimit
                                }
                            },
                            generator: {
                                // 输出文件位置以及文件名
                                filename: `${paths.outPath}media/[name].[hash:8].[ext]`
                            }
                        },
                        // Process application JS with Babel.
                        // The preset includes JSX, Flow, TypeScript, and some ESnext features.
                        {
                            test: /\.(js|mjs|jsx)$/,
                            include: [paths.appSrc],
                            use: [
                                {
                                    loader: 'babel-loader',
                                    options: {
                                        customize: require.resolve('babel-preset-react-app/webpack-overrides'),
                                        presets: [
                                            [
                                                require.resolve('babel-preset-react-app'),
                                                {
                                                    runtime: hasJsxRuntime ? 'automatic' : 'classic'
                                                }
                                            ]
                                        ],

                                        plugins: [isEnvDevelopment && shouldUseReactRefresh && require.resolve('react-refresh/babel')].filter(
                                            Boolean
                                        ),
                                        // 开启babel缓存
                                        cacheDirectory: true,
                                        // 默认为 true，将缓存内容压缩为 gz 包以减⼩缓存⽬录的体积。在设为 false 的情况下将跳过压缩和解压的过程
                                        cacheCompression: false,
                                        compact: isEnvProduction
                                    }
                                }
                            ]
                        },
                        // Process any JS outside of the app with Babel.
                        // Unlike the application JS, we only compile the standard ES features.
                        {
                            test: /\.(js|mjs)$/,
                            exclude: /@babel(?:\/|\\{1,2})runtime/,
                            use: [
                                {
                                    loader: 'babel-loader',
                                    options: {
                                        babelrc: false,
                                        configFile: false,
                                        compact: false,
                                        presets: [[require.resolve('babel-preset-react-app/dependencies'), { helpers: true }]],
                                        cacheDirectory: true,
                                        // See #6846 for context on why cacheCompression is disabled
                                        cacheCompression: false,

                                        // Babel sourcemaps are needed for debugging into node_modules
                                        // code.  Without the options below, debuggers like VSCode
                                        // show incorrect code and set breakpoints on the wrong lines.
                                        sourceMaps: shouldUseSourceMap,
                                        inputSourceMap: shouldUseSourceMap
                                    }
                                }
                            ]
                        },
                        // "postcss" loader applies autoprefixer to our CSS.
                        // "css" loader resolves paths in CSS and adds assets as dependencies.
                        // "style" loader turns CSS into JS modules that inject <style> tags.
                        // In production, we use MiniCSSExtractPlugin to extract that CSS
                        // to a file, but in development "style" loader enables hot editing
                        // of CSS.
                        // By default we support CSS Modules with the extension .module.css
                        {
                            test: cssRegex,
                            exclude: cssModuleRegex,
                            use: getStyleLoaders({
                                importLoaders: 3,
                                sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
                                modules: {
                                    mode: 'icss'
                                }
                            }),
                            // Don't consider CSS imports dead code even if the
                            // containing package claims to have no side effects.
                            // Remove this when webpack adds a warning or an error for this.
                            // See https://github.com/webpack/webpack/issues/6571
                            sideEffects: true
                        },
                        // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
                        // using the extension .module.css
                        {
                            test: cssModuleRegex,
                            use: getStyleLoaders({
                                importLoaders: 3,
                                sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
                                modules: {
                                    mode: 'local',
                                    getLocalIdent: getCSSModuleLocalIdent
                                }
                            })
                        },
                        // Opt-in support for SASS (using .scss or .sass extensions).
                        // By default we support SASS Modules with the
                        // extensions .module.scss or .module.sass
                        {
                            test: lessRegex,
                            exclude: lessModuleRegex,
                            use: getStyleLoaders(
                                {
                                    importLoaders: 3,
                                    sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
                                    modules: {
                                        mode: 'icss'
                                    }
                                },
                                'less-loader'
                            ),
                            // Don't consider CSS imports dead code even if the
                            // containing package claims to have no side effects.
                            // Remove this when webpack adds a warning or an error for this.
                            // See https://github.com/webpack/webpack/issues/6571
                            sideEffects: true
                        },
                        // Adds support for CSS Modules, but using SASS
                        // using the extension .module.scss or .module.sass
                        {
                            test: lessModuleRegex,
                            use: getStyleLoaders(
                                {
                                    importLoaders: 3,
                                    sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
                                    modules: {
                                        mode: 'local',
                                        getLocalIdent: getCSSModuleLocalIdent
                                    }
                                },
                                'less-loader'
                            )
                        },
                        // "file" loader makes sure those assets get served by WebpackDevServer.
                        // When you `import` an asset, you get its (virtual) filename.
                        // In production, they would get copied to the `build` folder.
                        // This loader doesn't use a "test" so it will catch all modules
                        // that fall through the other loaders.
                        {
                            // Exclude `js` files to keep "css" loader working as it injects
                            // its runtime that would otherwise be processed through "file" loader.
                            // Also exclude `html` and `json` extensions so they get processed
                            // by webpacks internal loaders.
                            exclude: [/^$/, /\.(js|mjs|jsx)$/, /\.html$/, /\.json$/],
                            type: 'asset/resource',
                            generator: {
                                // 输出文件位置以及文件名
                                filename: `${paths.outPath}media/[name].[hash:8][ext]`
                            }
                        }
                        // ** STOP ** Are you adding a new loader?
                        // Make sure to add the new loader(s) before the "file" loader.
                    ]
                }
            ].filter(Boolean)
        },
        plugins: [
            // new BundleAnalyzerPlugin(),
            isEnvDevelopment &&
                new ProgressBarPlugin({
                    complete: '█',
                    format: `${chalk.cyan('Building')} [ ${chalk.cyan(':bar')} ]  ${chalk.bold('(:percent)')}`,
                    clear: false
                }),
            // isEnvProduction &&
            //     new CompressionPlugin({
            //         filename: '[path].gz[query]', // 目标资源名称。[file] 会被替换成原资源。[path] 会被替换成原资源路径，[query] 替换成原查询字符串
            //         algorithm: 'gzip', // 算法
            //         test: new RegExp('\\.(js|css)$'), // 压缩 js 与 css
            //         threshold: 10240, // 只处理比这个值大的资源。按字节计算
            //         minRatio: 0.8 // 只有压缩率比这个值小的资源才会被处理
            //     }),
            new webpack.AutomaticPrefetchPlugin(),
            // Generates an `index.html` file with the <script> injected.
            ...getHtmlWebpackPlugin(),
            new PreloadWebpackPlugin({
                rel: 'preload',
                include: 'allChunks'
            }),
            new PreloadWebpackPlugin({
                rel: 'prefetch',
                include: 'asyncChunks'
            }),
            // Inlines the webpack runtime script. This script is too small to warrant
            // a network request.
            // https://github.com/facebook/create-react-app/issues/5358
            isEnvProduction && shouldInlineRuntimeChunk && new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime-.+[.]js/]),
            // Makes some environment variables available in index.html.
            // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
            // <link rel="icon" href="%PUBLIC_URL%/favicon.ico">
            // It will be an empty string unless you specify "homepage"
            // in `package.json`, in which case it will be the pathname of that URL.
            new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
            // This gives some necessary context to module not found errors, such as
            // the requesting resource.
            new ModuleNotFoundPlugin(paths.appPath),
            // Makes some environment variables available to the JS code, for example:
            // if (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
            // It is absolutely essential that NODE_ENV is set to production
            // during a production build.
            // Otherwise React will be compiled in the very slow development mode.
            new webpack.DefinePlugin(env.stringified),
            // Experimental hot reloading for React .
            // https://github.com/facebook/react/tree/main/packages/react-refresh
            isEnvDevelopment &&
                shouldUseReactRefresh &&
                new ReactRefreshWebpackPlugin({
                    overlay: false
                }),
            // Watcher doesn't work well if you mistype casing in a path so we use
            // a plugin that prints an error when you attempt to do this.
            // See https://github.com/facebook/create-react-app/issues/240
            isEnvDevelopment && new CaseSensitivePathsPlugin(),
            isEnvProduction &&
                new MiniCssExtractPlugin({
                    // Options similar to the same options in webpackOptions.output
                    // both options are optional
                    filename: `${paths.outPath}css/[name].[contenthash:8].css`,
                    chunkFilename: `${paths.outPath}css/[name].[contenthash:8].chunk.css`,
                    ignoreOrder: true
                }),
            // Generate an asset manifest file with the following content:
            // - "files" key: Mapping of all asset filenames to their corresponding
            //   output file so that tools can pick it up without having to parse
            //   `index.html`
            // - "entrypoints" key: Array of files which are included in `index.html`,
            //   can be used to reconstruct the HTML if necessary
            !paths.multiPage &&
                new WebpackManifestPlugin({
                    fileName: `${paths.outPath}asset-manifest.json`,
                    publicPath: paths.publicUrlOrPath,
                    generate: (seed, files, entrypoints) => {
                        const manifestFiles = files.reduce((manifest, file) => {
                            manifest[file.name] = file.path;
                            return manifest;
                        }, seed);

                        let entrypointFiles = [];

                        entrypointFiles = entrypoints.main.filter((fileName) => !fileName.endsWith('.map'));
                        return {
                            files: manifestFiles,
                            entrypoints: entrypointFiles
                        };
                    }
                }),
            // Moment.js is an extremely popular library that bundles large locale files
            // by default due to how webpack interprets its code. This is a practical
            // solution that requires the user to opt into importing specific locales.
            // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
            // You can remove this if you don't use Moment.js:
            new webpack.IgnorePlugin({
                resourceRegExp: /^\.\/locale$/,
                contextRegExp: /moment$/
            })
            // Generate a service worker script that will precache, and keep up to date,
            // the HTML & assets that are part of the webpack build.
            // isEnvProduction &&
            //     fs.existsSync(swSrc) &&
            //     new WorkboxWebpackPlugin.InjectManifest({
            //         swSrc,
            //         dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
            //         exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
            //         // Bump up the default maximum size (2mb) that's precached,
            //         // to make lazy-loading failure scenarios less likely.
            //         // See https://github.com/cra-template/pwa/issues/13#issuecomment-722667270
            //         maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
            //     })
            // TypeScript type checking
            // useTypeScript &&
            // new ForkTsCheckerWebpackPlugin({
            //     async: isEnvDevelopment,
            //     typescript: {
            //         typescriptPath: resolve.sync('typescript', {
            //             basedir: paths.appNodeModules
            //         }),
            //         configOverwrite: {
            //             compilerOptions: {
            //                 sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
            //                 skipLibCheck: true,
            //                 inlineSourceMap: false,
            //                 declarationMap: false,
            //                 noEmit: true,
            //                 incremental: true,
            //                 tsBuildInfoFile: paths.appTsBuildInfoFile
            //             }
            //         },
            //         context: paths.appPath,
            //         diagnosticOptions: {
            //             syntactic: true
            //         },
            //         mode: 'write-references'
            //         // profile: true,
            //     },
            //     issue: {
            //         // This one is specifically to match during CI tests,
            //         // as micromatch doesn't match
            //         // '../cra-template-typescript/template/src/App.tsx'
            //         // otherwise.
            //         include: [{ file: '../**/src/**/*.{ts,tsx}' }, { file: '**/src/**/*.{ts,tsx}' }],
            //         exclude: [
            //             { file: '**/src/**/__tests__/**' },
            //             { file: '**/src/**/?(*.){spec|test}.*' },
            //             { file: '**/src/setupProxy.*' },
            //             { file: '**/src/setupTests.*' }
            //         ]
            //     },
            //     logger: {
            //         infrastructure: 'silent'
            //     }
            // })
            // !disableESLintPlugin &&
            //     new ESLintPlugin({
            //         // Plugin options
            //         extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
            //         formatter: require.resolve('react-dev-utils/eslintFormatter'),
            //         eslintPath: require.resolve('eslint'),
            //         failOnError: !(isEnvDevelopment && emitErrorsAsWarnings),
            //         context: paths.appSrc,
            //         cache: true,
            //         cacheLocation: path.resolve(paths.appNodeModules, '.cache/.eslintcache'),
            //         // ESLint class options
            //         cwd: paths.appPath,
            //         resolvePluginsRelativeTo: __dirname,
            //         baseConfig: {
            //             extends: [require.resolve('eslint-config-react-app/base')],
            //             rules: {
            //                 ...(!hasJsxRuntime && {
            //                     'react/react-in-jsx-scope': 'error'
            //                 })
            //             }
            //         }
            //     })
        ].filter(Boolean),
        // https://webpack.docschina.org/configuration/performance/#root 忽略 资源过大的报警
        performance: false,
        // https://github.com/ant-design/ant-design/issues/33327 忽略 less map找不到的报告
        ignoreWarnings: [/Failed to parse source map/]
    };
};
