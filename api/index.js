const innerApp = require('../serveur/server');

module.exports = (req, res) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.slice(4) || '/';
  }
  innerApp(req, res);
};
