module.exports = function (api) {
  const removeConsole = process.env.EXPO_PUBLIC_APP_ENV === 'production';
  api.cache.using(() => String(removeConsole));
  return {
    presets: ['babel-preset-expo'],
    plugins: removeConsole ? ['transform-remove-console'] : [],
  };
};
