const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = (config, context) => {
  if (!context.options.customAssets) return config;

  const patterns = context.options.customAssets;
  // .map((asset) => {
  //   console.log(asset);
  //   return {
  //     from: path.resolve(context.options.root, asset.from, '**'),
  //     to: asset.toRelative,
  //   };
  // });

  return {
    ...config,
    plugins: [...config.plugins, new CopyWebpackPlugin({ patterns })],
  };
};
