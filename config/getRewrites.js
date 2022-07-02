/*
 * @Author: yanghongxuan
 * @Date: 2022-06-17 14:25:09
 * @LastEditors: yanghongxuan
 * @LastEditTime: 2022-06-17 14:39:22
 * @Description:
 */
const paths = require('./paths');

function getRewrites() {
    if (paths.entriesPath.length) {
        return paths.entriesPath.map(({ name }) => {
            return {
                from: new RegExp(`^\/${name}`),
                to: `/${name}.html`
            }
        })
    } else {
        return [];
    }
}

module.exports = getRewrites;
