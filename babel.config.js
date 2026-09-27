module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Lets Drizzle's migrations.js import the .sql migration files as plain strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
