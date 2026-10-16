// Vercel serverless function: every request is rewritten here (see vercel.json).
// The Nest app is compiled to dist/ by the build step first.
const { getHandler } = require('../dist/serverless');

module.exports = async (req, res) => {
  const handler = await getHandler();
  handler(req, res);
};
