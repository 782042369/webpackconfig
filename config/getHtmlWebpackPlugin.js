/*
 * @Author: yanghongxuan
 * @Date: 2022-06-17 14:25:09
 * @LastEditors: yanghongxuan
 * @LastEditTime: 2022-06-18 12:09:34
 * @Description:
 */
const paths = require('./paths');
const appEntry = require('./getEntry');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// const getMeta = require('./getMeta');

const isEnvProduction = process.env.NODE_ENV === 'production';

function pluginConfig(config = {}, template = paths.appHtml) {
    return Object.assign(
        {
            ...config
        },
        // getMeta(),
        {
            inject: true,
            template: template
        },
        isEnvProduction
            ? {
                  minify: {
                      removeComments: true,
                      collapseWhitespace: true,
                      removeRedundantAttributes: true,
                      useShortDoctype: true,
                      removeEmptyAttributes: true,
                      removeStyleLinkTypeAttributes: true,
                      keepClosingSlash: true,
                      minifyJS: true,
                      minifyCSS: true,
                      minifyURLs: true
                  }
              }
            : undefined
    );
}
function getHtmlWebpackPlugin() {
    if (paths.multiPage) {
        return Object.keys(appEntry).map(
            (name) =>
                new HtmlWebpackPlugin(
                    pluginConfig({
                        filename: `${name}.html`,
                        chunks: [name]
                    })
                )
        );
    } else {
        return isEnvProduction
            ? [
                  new HtmlWebpackPlugin(
                      pluginConfig({
                          filename: `./index.html`
                      })
                  ),
                  new HtmlWebpackPlugin(
                      pluginConfig({
                          filename: `./home.html`
                      })
                  )
              ]
            : [new HtmlWebpackPlugin(pluginConfig())];
    }
}

module.exports = getHtmlWebpackPlugin;
