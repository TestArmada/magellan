var path = require("path"),
  fs = require("fs"),
  _ = require("lodash"),
  acorn = require("acorn"),
  clc = require("cli-color"),
  walk = require("acorn/dist/walk");

module.exports = function(tags, f) {
  // Filter by tag (or tag list):
  //
  // Parse the syntax tree of each included test and search for it() calls
  // which have description strings containing the @tag we're looking for.
  // Example:
  //
  //  it("should function correctly @basic")
  //
  // Match each f in files against the tag list we have in the array tags.
  //
  var foundTags = false;
  var pass = false;
  var filename = path.resolve(f.filename);
  var root;
  try {
    root = acorn.parse(fs.readFileSync(filename), {
      ecmaVersion: 6
    });
  } catch (err) {
    console.log(clc.redBright("Syntax error in parsing " + filename));
    throw err;
  }

  walk.findNodeAt(root, null, null, function (nodeType, node) {
    if (nodeType === "CallExpression" && node.callee.name === "it" && node.arguments[0].value === f.path) {
      var name = node.arguments[0].value;
      name.split(" ").forEach(function (token) {
        // chop off the @ at beginning of @tag
        if (_.indexOf(tags, token.trim().substr(1)) > -1) {
          // FIXME: this seems to match if even one tag matches.
          // i.e. if the token we're currently looking at matches any of our *requested*
          // tags, we match. Meaning --tags functions like an OR instead of an AND
          pass = true;
        }
      })
    }
  });

  return pass;
};